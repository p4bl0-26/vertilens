/**
 * @file route.ts  (src/app/api/anchor/route.ts)
 * @description Next.js App Router Route Handler for anchoring a registered
 *              asset's SHA-256 hash on the Monad Testnet ProvenanceRegistry.
 *
 * ENDPOINT:     POST /api/anchor
 * CONTENT-TYPE: application/json
 *
 * REQUEST BODY:
 * {
 *   assetId: string   — UUID of the asset to anchor (required)
 *   sha256:  string   — SHA-256 hex of the asset, 64 chars (required)
 * }
 *
 * PIPELINE:
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Parse and validate the JSON body (assetId + sha256).
 *  2. Verify the asset exists in Supabase and sha256 matches the stored value.
 *  3. Idempotency: if assets.tx_hash is already set, return the cached result.
 *  4. Convert sha256 → bytes32, call anchorHash() on ProvenanceRegistry,
 *     wait for 1-block confirmation.
 *  5. UPDATE assets SET tx_hash, contract_address, anchored_at WHERE id = assetId.
 *  6. INSERT into anchors table (full audit record).
 *  7. Return the anchor result.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RESPONSE (new anchor):
 * { success: true, data: { txHash, blockNumber, chainHash, assetId, anchoredBy, contractAddress, alreadyAnchored: false } }
 *
 * RESPONSE (already anchored):
 * { success: true, data: { ..., alreadyAnchored: true } }
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
import { anchorHash } from "@/lib/provenance";
import { PROVENANCE_CONTRACT_ADDRESS } from "@/lib/contract";

// ─── Response Types ───────────────────────────────────────────────────────────

/** Shape of the success data payload. */
interface AnchorResponseData {
  /** 0x-prefixed Monad Testnet transaction hash. */
  txHash: string;
  /** Block number in which the transaction was mined. */
  blockNumber: number;
  /** The SHA-256 hex string that was anchored (matches assets.sha256). */
  chainHash: string;
  /** UUID of the anchored asset. */
  assetId: string;
  /** Wallet address that signed the anchorHash() transaction. */
  anchoredBy: string;
  /** The ProvenanceRegistry contract address used for anchoring. */
  contractAddress: string;
  /**
   * True if the asset was already anchored (cached result returned).
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
 * Accepts assetId + sha256, converts sha256 → bytes32, calls anchorHash()
 * on the deployed ProvenanceRegistry, waits for confirmation, then writes
 * tx_hash / contract_address / anchored_at back into the assets table.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: true; data: AnchorResponseData } | { success: false; error: ErrorPayload }>> {

  const requestId = uuidv4().slice(0, 8);
  const tag       = `[anchor][${requestId}]`;

  console.log(`${tag} ▶ Incoming POST /api/anchor`);

  // ── Step 1: Parse and validate body ────────────────────────────────────────
  let assetId: string;
  let sha256: string;

  try {
    const body = await request.json() as Record<string, unknown>;

    if (typeof body.assetId !== "string" || body.assetId.trim().length === 0) {
      return errorResponse(
        "INVALID_BODY",
        "Missing required field: assetId (non-empty string UUID).",
        400
      );
    }
    if (typeof body.sha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(body.sha256.trim())) {
      return errorResponse(
        "INVALID_BODY",
        "Missing or invalid field: sha256 must be a 64-character hex string.",
        400
      );
    }

    assetId = body.assetId.trim();
    sha256  = body.sha256.trim().toLowerCase();
  } catch {
    return errorResponse(
      "INVALID_JSON",
      "Request body must be valid JSON: { assetId: string, sha256: string }.",
      400
    );
  }

  console.log(`${tag} assetId=${assetId}, sha256=${sha256.slice(0, 16)}...`);

  // ── Step 2: Initialise Supabase admin client ────────────────────────────────
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
    console.log(`${tag} ✓ Supabase admin client ready.`);
  } catch (err) {
    console.error(`${tag} ✗ Supabase init failed:`, err);
    return errorResponse(
      "SUPABASE_CONFIG_ERROR",
      "Server configuration error — Supabase client could not be initialised.",
      500
    );
  }

  // ── Step 3: Fetch and validate the asset ───────────────────────────────────
  console.log(`${tag} Fetching asset ${assetId}...`);

  const { data: assetData, error: assetError } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) {
    console.error(`${tag} ✗ DB error fetching asset:`, assetError);
    return errorResponse(
      "DB_FETCH_ERROR",
      `Database error fetching asset ${assetId}: ${assetError.message}`,
      500
    );
  }
  if (!assetData) {
    console.warn(`${tag} ✗ Asset not found: ${assetId}`);
    return errorResponse(
      "ASSET_NOT_FOUND",
      `No asset found with id "${assetId}".`,
      404
    );
  }

  const asset = assetData as AssetRecord;

  // Verify sha256 matches the stored value to prevent misuse.
  if (asset.sha256.toLowerCase() !== sha256) {
    console.warn(`${tag} ✗ sha256 mismatch. Stored: ${asset.sha256.slice(0, 16)}..., Provided: ${sha256.slice(0, 16)}...`);
    return errorResponse(
      "SHA256_MISMATCH",
      "The provided sha256 does not match the stored hash for this asset.",
      422
    );
  }

  console.log(`${tag} ✓ Asset verified: filename="${asset.filename}"`);

  // ── Step 4: Idempotency — check assets.tx_hash ─────────────────────────────
  // If we've already written tx_hash to assets, the anchor is complete.
  if (asset.tx_hash) {
    console.log(`${tag} ✅ Asset already anchored (assets.tx_hash set). Returning cached result.`);
    return NextResponse.json({
      success: true,
      data: {
        txHash:          asset.tx_hash,
        blockNumber:     0, // block number not stored directly on assets; available in anchors table
        chainHash:       asset.sha256,
        assetId:         asset.id,
        anchoredBy:      "",
        contractAddress: asset.contract_address ?? PROVENANCE_CONTRACT_ADDRESS,
        alreadyAnchored: true,
      } satisfies AnchorResponseData,
    });
  }

  // Also check the anchors table for a fuller idempotency record.
  const { data: existingAnchor } = await supabase
    .from("anchors")
    .select("*")
    .eq("asset_id", asset.id)
    .limit(1)
    .maybeSingle();

  if (existingAnchor) {
    const anchor = existingAnchor as AnchorRecord;
    console.log(`${tag} ✅ Anchor record found in anchors table. txHash: ${anchor.tx_hash}`);

    // Backfill assets row if somehow it wasn't updated.
    await supabase
      .from("assets")
      .update({
        tx_hash:          anchor.tx_hash,
        contract_address: PROVENANCE_CONTRACT_ADDRESS,
        anchored_at:      anchor.created_at,
      })
      .eq("id", asset.id);

    return NextResponse.json({
      success: true,
      data: {
        txHash:          anchor.tx_hash,
        blockNumber:     anchor.block_number,
        chainHash:       anchor.chain_hash,
        assetId:         anchor.asset_id,
        anchoredBy:      anchor.anchored_by,
        contractAddress: PROVENANCE_CONTRACT_ADDRESS,
        alreadyAnchored: true,
      } satisfies AnchorResponseData,
    });
  }

  console.log(`${tag} No existing anchor found. Proceeding with on-chain transaction.`);

  // ── Step 5: Anchor on-chain via provenance.ts ──────────────────────────────
  console.log(`${tag} Calling anchorHash(${sha256.slice(0, 16)}...)...`);

  let onChainResult: Awaited<ReturnType<typeof anchorHash>>;
  try {
    onChainResult = await anchorHash(sha256);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ✗ On-chain anchoring failed: ${message}`);

    if (message.includes("already registered")) {
      return errorResponse(
        "ALREADY_ANCHORED_ON_CHAIN",
        `This asset's hash is already registered in the ProvenanceRegistry contract ` +
        `but no Supabase anchor record was found. Manual reconciliation may be needed.`,
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
    `${tag} ✓ On-chain confirmed. txHash: ${onChainResult.txHash}, ` +
    `blockNumber: ${onChainResult.blockNumber}, anchoredBy: ${onChainResult.anchoredBy}`
  );

  // ── Step 6: UPDATE assets with anchor details ──────────────────────────────
  // Store tx_hash, contract_address, anchored_at directly on the assets row.
  const anchoredAt = new Date().toISOString();

  console.log(`${tag} Updating assets row with anchor details...`);

  const { error: updateError } = await supabase
    .from("assets")
    .update({
      tx_hash:          onChainResult.txHash,
      contract_address: PROVENANCE_CONTRACT_ADDRESS,
      anchored_at:      anchoredAt,
    })
    .eq("id", asset.id);

  if (updateError) {
    // On-chain tx succeeded but DB update failed — the chain is authoritative.
    // Log for manual reconciliation; still return success.
    console.error(
      `${tag} ⚠ CRITICAL: On-chain tx succeeded (${onChainResult.txHash}) ` +
      `but assets UPDATE failed: ${updateError.message}. Manual reconciliation needed.`
    );
  } else {
    console.log(`${tag} ✓ assets.tx_hash updated.`);
  }

  // ── Step 7: INSERT into anchors table (full audit record) ──────────────────
  console.log(`${tag} Writing full anchor record to anchors table...`);

  const { data: insertedAnchor, error: insertError } = await supabase
    .from("anchors")
    .insert({
      asset_id:     asset.id,
      chain_hash:   asset.sha256,
      tx_hash:      onChainResult.txHash,
      block_number: Number(onChainResult.blockNumber),
      anchored_by:  onChainResult.anchoredBy,
      chain_id:     onChainResult.chainId,
    })
    .select()
    .single();

  if (insertError) {
    console.error(
      `${tag} ⚠ anchors INSERT failed: ${insertError.message}. ` +
      `Chain record is authoritative. assets row updated successfully.`
    );
    // Non-fatal — assets row is already updated; return success with header.
    return NextResponse.json(
      {
        success: true,
        data: {
          txHash:          onChainResult.txHash,
          blockNumber:     Number(onChainResult.blockNumber),
          chainHash:       asset.sha256,
          assetId:         asset.id,
          anchoredBy:      onChainResult.anchoredBy,
          contractAddress: PROVENANCE_CONTRACT_ADDRESS,
          alreadyAnchored: false,
        } satisfies AnchorResponseData,
      },
      { headers: { "X-DB-Sync-Warning": "anchors table insert failed — see server logs." } }
    );
  }

  console.log(`${tag} ✅ Complete. anchors.id=${insertedAnchor?.id ?? "unknown"}`);

  return NextResponse.json({
    success: true,
    data: {
      txHash:          onChainResult.txHash,
      blockNumber:     Number(onChainResult.blockNumber),
      chainHash:       asset.sha256,
      assetId:         asset.id,
      anchoredBy:      onChainResult.anchoredBy,
      contractAddress: PROVENANCE_CONTRACT_ADDRESS,
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
        message: "POST /api/anchor — body: { assetId: string, sha256: string }",
      },
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
