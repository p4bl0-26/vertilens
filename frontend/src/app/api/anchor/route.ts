/**
 * @file route.ts  (src/app/api/anchor/route.ts)
 * @description Next.js App Router Route Handler for anchoring a registered
 *              asset's SHA-256 hash on the Monad Testnet ProvenanceRegistry.
 *
 * ENDPOINT:     POST /api/anchor
 * CONTENT-TYPE: application/json
 *
 * REQUEST BODY (optional — if omitted, anchors the most recently registered asset):
 * {
 *   assetId?: string   — UUID of a specific asset to anchor (optional)
 * }
 *
 * FULL PIPELINE:
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Parse and validate the request body.
 *  2. Fetch the target asset from Supabase:
 *       - If `assetId` is provided → fetch that specific asset.
 *       - If omitted → fetch the most recently registered asset
 *         (ordered by created_at DESC, limit 1).
 *  3. Guard: if asset already has an anchor record in the `anchors` table,
 *     return the existing anchor without submitting a new transaction.
 *  4. Call anchorHashOnChain(asset.sha256) from viem.ts:
 *       - Converts sha256 → bytes32
 *       - Checks isRegistered() on-chain (idempotency)
 *       - Submits anchorHash(bytes32) via the server wallet
 *       - Waits for 1-block confirmation
 *       - Returns txHash, blockNumber, anchoredBy, chainId
 *  5. Insert a row into the `anchors` Supabase table with all transaction details.
 *  6. Return the anchor result.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RESPONSE (success — new anchor):
 * {
 *   success: true,
 *   data: {
 *     txHash:       string  — 0x-prefixed Monad Testnet transaction hash
 *     blockNumber:  number  — block number where the tx was mined
 *     chainHash:    string  — SHA-256 that was anchored (matches assets.sha256)
 *     assetId:      string  — UUID of the anchored asset
 *     anchoredBy:   string  — wallet address that signed the transaction
 *     alreadyAnchored: false
 *   }
 * }
 *
 * RESPONSE (success — already anchored):
 * {
 *   success: true,
 *   data: {
 *     txHash:       string
 *     blockNumber:  number
 *     chainHash:    string
 *     assetId:      string
 *     anchoredBy:   string
 *     alreadyAnchored: true  — indicates a cached result was returned
 *   }
 * }
 *
 * RESPONSE (error):
 * { success: false, error: { code: string, message: string } }
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createAdminClient,
  type AssetRecord,
  type AnchorRecord,
} from "@/lib/supabase";
import { anchorHashOnChain } from "@/lib/viem";

// ─── Response Types ───────────────────────────────────────────────────────────

/** Shape of the data payload returned on success. */
interface AnchorResponseData {
  /** 0x-prefixed Monad Testnet transaction hash. */
  txHash: string;
  /** Block number in which the transaction was mined. */
  blockNumber: number;
  /** The SHA-256 hex string that was anchored on-chain. */
  chainHash: string;
  /** UUID of the asset that was anchored. */
  assetId: string;
  /** Wallet address that signed the anchorHash() transaction. */
  anchoredBy: string;
  /**
   * True if this anchor record already existed in the `anchors` table.
   * No new on-chain transaction was submitted in this case.
   */
  alreadyAnchored: boolean;
}

/** Standardised error envelope. */
interface ErrorPayload {
  code: string;
  message: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function errorResponse(
  code: string,
  message: string,
  status: number
): NextResponse<{ success: false; error: ErrorPayload }> {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/anchor
 *
 * Anchors the most recently registered (or a specified) asset on Monad Testnet.
 * Implements the full 5-step pipeline described in the file header.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: true; data: AnchorResponseData } | { success: false; error: ErrorPayload }>> {

  const requestId = uuidv4().slice(0, 8);
  const tag       = `[anchor][${requestId}]`;

  console.log(`${tag} ▶ Incoming POST /api/anchor`);

  // ── Step 1: Parse optional JSON body ───────────────────────────────────────
  let assetId: string | undefined;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = await request.json() as Record<string, unknown>;
      // Accept assetId if provided and is a non-empty string.
      if (typeof body.assetId === "string" && body.assetId.trim().length > 0) {
        assetId = body.assetId.trim();
        console.log(`${tag} assetId specified: ${assetId}`);
      }
    } catch {
      // Empty body or non-JSON — treat as "anchor latest" (assetId = undefined).
      console.log(`${tag} No JSON body or empty body — anchoring latest asset.`);
    }
  } else {
    console.log(`${tag} No JSON content-type — anchoring latest asset.`);
  }

  // ── Step 2: Initialise Supabase admin client ───────────────────────────────
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
    console.log(`${tag} ✓ Supabase admin client ready.`);
  } catch (err) {
    console.error(`${tag} ✗ Supabase client init failed:`, err);
    return errorResponse(
      "SUPABASE_CONFIG_ERROR",
      "Server configuration error — Supabase client could not be initialised.",
      500
    );
  }

  // ── Step 3: Fetch target asset ─────────────────────────────────────────────
  let asset: AssetRecord | null = null;

  if (assetId) {
    // Fetch the specific asset by UUID.
    console.log(`${tag} Fetching asset by id: ${assetId}`);
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .maybeSingle();

    if (error) {
      console.error(`${tag} ✗ Supabase error fetching asset by id:`, error);
      return errorResponse(
        "DB_FETCH_ERROR",
        `Database error fetching asset ${assetId}: ${error.message}`,
        500
      );
    }
    if (!data) {
      console.warn(`${tag} ✗ Asset not found: ${assetId}`);
      return errorResponse(
        "ASSET_NOT_FOUND",
        `No asset found with id "${assetId}".`,
        404
      );
    }
    asset = data as AssetRecord;
  } else {
    // Fetch the most recently registered asset.
    console.log(`${tag} Fetching the most recently registered asset...`);
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`${tag} ✗ Supabase error fetching latest asset:`, error);
      return errorResponse(
        "DB_FETCH_ERROR",
        `Database error fetching latest asset: ${error.message}`,
        500
      );
    }
    if (!data) {
      console.warn(`${tag} ✗ No assets registered yet.`);
      return errorResponse(
        "NO_ASSETS",
        "No assets have been registered yet. Upload and register an image first.",
        404
      );
    }
    asset = data as AssetRecord;
  }

  console.log(
    `${tag} ✓ Asset resolved: id=${asset.id}, filename="${asset.filename}", ` +
    `sha256=${asset.sha256.slice(0, 16)}...`
  );

  // ── Step 4: Idempotency — check existing anchor in Supabase ───────────────
  // Before hitting the chain, check if this asset has already been anchored
  // and recorded. This avoids redundant on-chain transactions.
  console.log(`${tag} Checking for existing anchor record for asset ${asset.id}...`);

  const { data: existingAnchor, error: anchorLookupError } = await supabase
    .from("anchors")
    .select("*")
    .eq("asset_id", asset.id)
    .limit(1)
    .maybeSingle();

  if (anchorLookupError) {
    // Non-fatal — log and proceed. We'll attempt the anchor anyway.
    console.warn(
      `${tag} ⚠ Could not check existing anchors (DB error): ` +
      `${anchorLookupError.message}. Proceeding with on-chain call.`
    );
  }

  if (existingAnchor) {
    const anchor = existingAnchor as AnchorRecord;
    console.log(
      `${tag} ✅ Asset already anchored. Returning existing anchor record. ` +
      `txHash: ${anchor.tx_hash}, blockNumber: ${anchor.block_number}`
    );
    return NextResponse.json({
      success: true,
      data: {
        txHash:          anchor.tx_hash,
        blockNumber:     anchor.block_number,
        chainHash:       anchor.chain_hash,
        assetId:         anchor.asset_id,
        anchoredBy:      anchor.anchored_by,
        alreadyAnchored: true,
      } satisfies AnchorResponseData,
    });
  }

  console.log(`${tag} No existing anchor found. Proceeding with on-chain transaction.`);

  // ── Step 5: Anchor on-chain via viem ──────────────────────────────────────
  // anchorHashOnChain() handles:
  //   - bytes32 conversion
  //   - isRegistered() pre-check (avoids revert on duplicate)
  //   - writeContract()
  //   - waitForTransactionReceipt()
  console.log(`${tag} Calling anchorHashOnChain(${asset.sha256.slice(0, 16)}...)...`);

  let onChainResult: Awaited<ReturnType<typeof anchorHashOnChain>>;
  try {
    onChainResult = await anchorHashOnChain(asset.sha256);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ✗ On-chain anchoring failed:`, message);

    // Special case: if the hash is already on-chain but not in our DB,
    // treat it as a soft error and advise the user.
    if (message.includes("already registered")) {
      return errorResponse(
        "ALREADY_ANCHORED_ON_CHAIN",
        `This asset's hash is already registered in the ProvenanceRegistry contract ` +
        `but no Supabase anchor record was found. ` +
        `Manual reconciliation may be needed. Original error: ${message}`,
        409
      );
    }

    return errorResponse(
      "BLOCKCHAIN_ERROR",
      `On-chain anchoring failed: ${message}`,
      500
    );
  }

  console.log(
    `${tag} ✓ On-chain anchor confirmed. ` +
    `txHash: ${onChainResult.txHash}, ` +
    `blockNumber: ${onChainResult.blockNumber}, ` +
    `anchoredBy: ${onChainResult.anchoredBy}`
  );

  // ── Step 6: Persist anchor record to Supabase ──────────────────────────────
  console.log(`${tag} Writing anchor record to Supabase...`);

  const anchorInsert = {
    asset_id:     asset.id,
    chain_hash:   asset.sha256,
    tx_hash:      onChainResult.txHash,
    block_number: Number(onChainResult.blockNumber), // bigint → number for Supabase BIGINT
    anchored_by:  onChainResult.anchoredBy,
    chain_id:     onChainResult.chainId,
  };

  const { data: insertedAnchor, error: insertError } = await supabase
    .from("anchors")
    .insert(anchorInsert)
    .select()
    .single();

  if (insertError) {
    // The on-chain transaction SUCCEEDED but the DB write FAILED.
    // This is a recoverable inconsistency — the chain record exists and is
    // the ground truth. Log prominently so it can be reconciled manually.
    console.error(
      `${tag} ⚠ CRITICAL: On-chain anchor succeeded (txHash: ${onChainResult.txHash}) ` +
      `but Supabase INSERT failed: ${insertError.message}. ` +
      `The blockchain record is authoritative. Manual DB reconciliation required.`
    );

    // Still return success — the chain record IS the source of truth.
    return NextResponse.json(
      {
        success: true,
        data: {
          txHash:          onChainResult.txHash,
          blockNumber:     Number(onChainResult.blockNumber),
          chainHash:       asset.sha256,
          assetId:         asset.id,
          anchoredBy:      onChainResult.anchoredBy,
          alreadyAnchored: false,
        } satisfies AnchorResponseData,
      },
      {
        // Indicate partial success via a custom header — useful for monitoring.
        headers: { "X-DB-Sync-Warning": "Supabase anchor insert failed — see server logs." },
      }
    );
  }

  console.log(
    `${tag} ✅ Anchor record saved. ` +
    `anchors.id=${insertedAnchor?.id ?? "unknown"}`
  );

  return NextResponse.json({
    success: true,
    data: {
      txHash:          onChainResult.txHash,
      blockNumber:     Number(onChainResult.blockNumber),
      chainHash:       asset.sha256,
      assetId:         asset.id,
      anchoredBy:      onChainResult.anchoredBy,
      alreadyAnchored: false,
    } satisfies AnchorResponseData,
  });
}

// ─── Method Guard ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code:    "METHOD_NOT_ALLOWED",
        message: "Use POST with an optional { assetId } JSON body to anchor an asset.",
      },
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
