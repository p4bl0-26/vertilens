/**
 * @file route.ts  (src/app/api/verify/route.ts)
 * @description Next.js App Router Route Handler for verifying whether an uploaded
 *              image matches a previously registered asset in the Nexora provenance system.
 *
 * ENDPOINT:   POST /api/verify
 * CONTENT:    multipart/form-data
 * FIELD:      "image" — the image file to verify against registered assets
 *
 * THREE-STEP VERIFICATION PIPELINE:
 * ─────────────────────────────────────────────────────────────────────────────
 *  STEP 1 — EXACT MATCH (SHA-256):
 *    Compute SHA-256 of the uploaded file. Query the `assets` table for a row
 *    with an identical SHA-256. If found, the file is a cryptographically exact
 *    copy of the registered original — byte-for-byte identical.
 *
 *    → Returns { status: "VERIFIED_ORIGINAL", ... }
 *
 *  STEP 2 — FUZZY MATCH (Perceptual aHash + Hamming Distance):
 *    If no exact SHA-256 match, compute the perceptual average hash (aHash) of
 *    the uploaded image. Fetch all registered assets and run computeHammingDistance()
 *    against each stored aHash. Find the closest match. If the best Hamming
 *    distance is < TAMPER_DETECTION_THRESHOLD (10 bits), the image is visually
 *    similar but not identical — indicating re-compression, minor editing, or
 *    deliberate tampering.
 *
 *    → Returns { status: "LIKELY_TAMPERED", ... }
 *
 *  STEP 3 — NO MATCH:
 *    If no asset produces a distance below the threshold, the image has no
 *    registered provenance in the system.
 *
 *    → Returns { status: "NOT_REGISTERED" }
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RESPONSE SHAPES:
 *
 *  VERIFIED_ORIGINAL:
 *  {
 *    success: true,
 *    data: {
 *      status: "VERIFIED_ORIGINAL",
 *      assetId: string,
 *      sha256: string,
 *      matchedAsset: AssetRecord
 *    }
 *  }
 *
 *  LIKELY_TAMPERED:
 *  {
 *    success: true,
 *    data: {
 *      status: "LIKELY_TAMPERED",
 *      assetId: string,
 *      hammingDistance: number,
 *      similarityPercent: number,
 *      tamperLevel: HammingResult["tamperLevel"],
 *      tamperDescription: string,
 *      matchedAsset: AssetRecord
 *    }
 *  }
 *
 *  NOT_REGISTERED:
 *  {
 *    success: true,
 *    data: { status: "NOT_REGISTERED" }
 *  }
 *
 *  ERROR:
 *  { success: false, error: { code: string, message: string } }
 */

import { NextRequest, NextResponse } from "next/server";
import { computeSHA256 } from "@/lib/hash/sha256";
import { computeAverageHash } from "@/lib/hash/averageHash";
import { computeHammingDistance, type HammingResult } from "@/lib/hash/hammingDistance";
import {
  createAdminClient,
  getPublicStorageUrl,
  type AssetRecord,
} from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum Hamming distance (in bits, out of 256) below which we classify an
 * image as "LIKELY_TAMPERED" rather than "NOT_REGISTERED".
 *
 * At 10 bits: ~96% similarity — catches re-compression, slight crops, and
 * brightness nudges while avoiding false positives on genuinely different images.
 *
 * Adjust this threshold based on real-world testing during the demo:
 *   - Lower (e.g., 5): Stricter — only very near-identical images match.
 *   - Higher (e.g., 20): Looser — more false positives but catches heavier edits.
 */
const TAMPER_DETECTION_THRESHOLD = 10;

/**
 * Maximum number of assets to load for fuzzy matching.
 * For a hackathon demo this is fine; in production you would use a vector
 * similarity index or a dedicated perceptual hash search service (e.g., pgvector).
 */
const MAX_ASSETS_FOR_FUZZY_SCAN = 1000;

/**
 * Allowed MIME types. Must mirror the allowlist in register/route.ts.
 */
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
  "image/gif",
]);

/** Maximum file size: 20 MB. */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ─── Response Types ───────────────────────────────────────────────────────────

/** Returned when the SHA-256 of the upload matches a registered asset exactly. */
interface VerifiedOriginalResult {
  status: "VERIFIED_ORIGINAL";
  assetId: string;
  sha256: string;
  matchedAsset: AssetRecord;
}

/** Returned when the aHash fuzzy scan finds a close match below the threshold. */
interface LikelyTamperedResult {
  status: "LIKELY_TAMPERED";
  assetId: string;
  hammingDistance: number;
  similarityPercent: number;
  tamperLevel: HammingResult["tamperLevel"];
  tamperDescription: string;
  matchedAsset: AssetRecord;
}

/** Returned when no registered asset matches by SHA-256 or fuzzy aHash scan. */
interface NotRegisteredResult {
  status: "NOT_REGISTERED";
}

type VerifyResult = VerifiedOriginalResult | LikelyTamperedResult | NotRegisteredResult;

/** Standardised error envelope. */
interface ErrorPayload {
  code: string;
  message: string;
}

// ─── Helper: Build error response ────────────────────────────────────────────

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
 * POST /api/verify
 *
 * Accepts a multipart/form-data body with a single "image" field.
 * Runs the three-step verification pipeline described in the file header.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: true; data: VerifyResult } | { success: false; error: ErrorPayload }>> {

  // Unique per-request ID for correlating log lines across the full pipeline.
  const requestId = uuidv4().slice(0, 8);
  const tag = `[verify][${requestId}]`;

  console.log(`${tag} ▶ Incoming POST /api/verify`);
  console.log(`${tag} Content-Type: ${request.headers.get("content-type") ?? "none"}`);

  // ── Parse multipart/form-data ─────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error(`${tag} ✗ Failed to parse FormData:`, err);
    return errorResponse(
      "INVALID_FORM_DATA",
      "Request body could not be parsed as multipart/form-data.",
      400
    );
  }

  // ── Extract and validate "image" field ────────────────────────────────────
  const imageField = formData.get("image");

  if (!imageField) {
    console.warn(`${tag} ✗ Missing "image" field`);
    return errorResponse(
      "MISSING_IMAGE_FIELD",
      'No "image" field found. Include the image as a field named "image".',
      400
    );
  }

  if (!(imageField instanceof File)) {
    console.warn(`${tag} ✗ "image" is not a File — got: ${typeof imageField}`);
    return errorResponse(
      "INVALID_IMAGE_FIELD",
      '"image" must be a file (File/Blob), not a plain string.',
      400
    );
  }

  const uploadedFile = imageField as File;

  console.log(
    `${tag} File received: name="${uploadedFile.name}", ` +
    `type="${uploadedFile.type}", size=${uploadedFile.size} bytes`
  );

  // ── Validate MIME type ────────────────────────────────────────────────────
  if (!ACCEPTED_MIME_TYPES.has(uploadedFile.type)) {
    console.warn(`${tag} ✗ Unsupported MIME type: "${uploadedFile.type}"`);
    return errorResponse(
      "UNSUPPORTED_IMAGE_TYPE",
      `File type "${uploadedFile.type}" is not supported. ` +
      `Accepted: ${[...ACCEPTED_MIME_TYPES].join(", ")}.`,
      415
    );
  }

  // ── Validate file size ────────────────────────────────────────────────────
  if (uploadedFile.size === 0) {
    console.warn(`${tag} ✗ Empty file`);
    return errorResponse("EMPTY_FILE", "The uploaded file is empty (0 bytes).", 400);
  }

  if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (uploadedFile.size / 1024 / 1024).toFixed(2);
    console.warn(`${tag} ✗ File too large: ${sizeMB} MB`);
    return errorResponse(
      "FILE_TOO_LARGE",
      `File size ${sizeMB} MB exceeds the 20 MB maximum.`,
      413
    );
  }

  // ── Convert File → Buffer ─────────────────────────────────────────────────
  let fileBuffer: Buffer;
  try {
    const arrayBuffer = await uploadedFile.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    console.log(`${tag} ✓ File converted to Buffer (${fileBuffer.length} bytes)`);
  } catch (err) {
    console.error(`${tag} ✗ Buffer conversion failed:`, err);
    return errorResponse(
      "FILE_READ_ERROR",
      "Failed to read the uploaded file. It may be corrupt or the upload was interrupted.",
      500
    );
  }

  // ── Compute SHA-256 ───────────────────────────────────────────────────────
  let uploadedSha256: string;
  try {
    uploadedSha256 = computeSHA256(fileBuffer);
    console.log(`${tag} ✓ SHA-256: ${uploadedSha256}`);
  } catch (err) {
    console.error(`${tag} ✗ SHA-256 failed:`, err);
    return errorResponse(
      "HASH_COMPUTATION_ERROR",
      "Failed to compute SHA-256 fingerprint of the uploaded image.",
      500
    );
  }

  // ── Initialise Supabase admin client ──────────────────────────────────────
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
    console.log(`${tag} ✓ Supabase admin client ready`);
  } catch (err) {
    console.error(`${tag} ✗ Supabase client init failed:`, err);
    return errorResponse(
      "SUPABASE_CONFIG_ERROR",
      "Server configuration error — database client could not be initialised.",
      500
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  STEP 1: EXACT SHA-256 MATCH
  // ════════════════════════════════════════════════════════════════════════════
  //
  // Query the `assets` table for a row whose `sha256` column exactly matches
  // the computed hash. This is an O(1) indexed lookup — extremely fast.
  //
  // If a match is found, the uploaded file is byte-for-byte identical to the
  // registered original. No tampering possible at the byte level.
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`${tag} ── STEP 1: Exact SHA-256 lookup...`);

  const { data: exactMatch, error: exactMatchError } = await supabase
    .from("assets")
    .select("*")           // Fetch the full AssetRecord to include in the response
    .eq("sha256", uploadedSha256)
    .maybeSingle();        // Returns null (not an error) when no row is found

  if (exactMatchError) {
    console.error(`${tag} ✗ DB error during SHA-256 lookup:`, exactMatchError);
    return errorResponse(
      "DB_LOOKUP_ERROR",
      `Database error during exact match lookup: ${exactMatchError.message}`,
      500
    );
  }

  if (exactMatch) {
    // ── RESULT: VERIFIED_ORIGINAL ─────────────────────────────────────────
    console.log(
      `${tag} ✅ STEP 1 HIT — VERIFIED_ORIGINAL. ` +
      `Matched asset id=${exactMatch.id}, filename="${exactMatch.filename}"`
    );

    return NextResponse.json({
      success: true,
      data: {
        status: "VERIFIED_ORIGINAL",
        assetId: exactMatch.id,
        sha256: uploadedSha256,
        matchedAsset: exactMatch as AssetRecord,
      } satisfies VerifiedOriginalResult,
    });
  }

  console.log(`${tag} ── STEP 1 MISS — No exact SHA-256 match. Proceeding to fuzzy scan.`);

  // ════════════════════════════════════════════════════════════════════════════
  //  STEP 2: FUZZY aHASH SCAN (Hamming Distance)
  // ════════════════════════════════════════════════════════════════════════════
  //
  // No exact byte match — the image may have been modified. Compute the
  // perceptual average hash (aHash) of the uploaded image, then compare
  // it against every registered aHash using Hamming distance.
  //
  // We fetch all assets from the DB and run comparisons in-process. For the
  // hackathon scale (< 1000 assets) this is fast enough. In production, this
  // would use a pgvector similarity index or a dedicated hash search service.
  // ─────────────────────────────────────────────────────────────────────────

  // ── Compute perceptual hash of the uploaded image ─────────────────────────
  let uploadedAhash: string;
  try {
    uploadedAhash = await computeAverageHash(fileBuffer);
    console.log(`${tag} ✓ aHash: ${uploadedAhash}`);
  } catch (err) {
    console.error(`${tag} ✗ aHash computation failed:`, err);
    return errorResponse(
      "PERCEPTUAL_HASH_ERROR",
      "Failed to compute the perceptual hash of the uploaded image.",
      500
    );
  }

  // ── Load all registered assets for scanning ───────────────────────────────
  console.log(
    `${tag} ── STEP 2: Loading up to ${MAX_ASSETS_FOR_FUZZY_SCAN} registered ` +
    `assets for fuzzy aHash scan...`
  );

  const { data: allAssets, error: fetchAllError } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_ASSETS_FOR_FUZZY_SCAN);

  if (fetchAllError) {
    console.error(`${tag} ✗ DB error fetching all assets:`, fetchAllError);
    return errorResponse(
      "DB_FETCH_ERROR",
      `Database error while loading assets for comparison: ${fetchAllError.message}`,
      500
    );
  }

  if (!allAssets || allAssets.length === 0) {
    // Edge case: no assets are registered yet in the system.
    console.log(`${tag} ── No assets in database. Returning NOT_REGISTERED.`);
    return NextResponse.json({
      success: true,
      data: { status: "NOT_REGISTERED" } satisfies NotRegisteredResult,
    });
  }

  console.log(`${tag} Scanning ${allAssets.length} registered asset(s)...`);

  // ── Compare uploaded aHash against all stored aHashes ────────────────────
  // Track the closest match found during the scan.
  let bestDistance = Infinity;
  let bestResult: HammingResult | null = null;
  let bestAsset: AssetRecord | null = null;

  for (const asset of allAssets as AssetRecord[]) {
    // Guard: skip assets with missing or malformed aHash values.
    // This can happen if a row was inserted manually or by a previous bug.
    if (!asset.ahash || asset.ahash.length === 0) {
      console.warn(
        `${tag} ⚠ Skipping asset id=${asset.id} — missing or empty ahash field.`
      );
      continue;
    }

    // Guard: skip if hash lengths differ (different algorithm or hash size).
    if (asset.ahash.length !== uploadedAhash.length) {
      console.warn(
        `${tag} ⚠ Skipping asset id=${asset.id} — ahash length mismatch ` +
        `(stored: ${asset.ahash.length}, uploaded: ${uploadedAhash.length}).`
      );
      continue;
    }

    let hammingResult: HammingResult;
    try {
      // hashA = the registered original's aHash (from DB)
      // hashB = the newly uploaded image's aHash (computed above)
      hammingResult = computeHammingDistance(asset.ahash, uploadedAhash);
    } catch (err) {
      // A single bad comparison should not abort the entire scan.
      console.error(
        `${tag} ⚠ Hamming distance computation failed for asset id=${asset.id}:`,
        err
      );
      continue;
    }

    console.log(
      `${tag}   asset id=${asset.id.slice(0, 8)}... | ` +
      `distance=${hammingResult.distance} | ` +
      `similarity=${hammingResult.similarityPercent}% | ` +
      `level=${hammingResult.tamperLevel}`
    );

    // Update best match if this asset is closer than any seen so far.
    if (hammingResult.distance < bestDistance) {
      bestDistance = hammingResult.distance;
      bestResult = hammingResult;
      bestAsset = asset;

      // Early exit optimisation: a distance of 0 is a perfect perceptual match.
      // In theory this shouldn't happen (SHA-256 would have caught it in Step 1),
      // but it could occur if two different files produce the same aHash due to
      // hash collision at the 256-bit perceptual level.
      if (bestDistance === 0) {
        console.log(
          `${tag} ⚡ Perfect aHash match found (distance=0). ` +
          `Short-circuiting scan.`
        );
        break;
      }
    }
  }

  console.log(
    `${tag} ── Scan complete. Best distance: ${bestDistance} ` +
    `(threshold: ${TAMPER_DETECTION_THRESHOLD})`
  );

  // ── Evaluate the best match against the threshold ─────────────────────────
  if (
    bestDistance < TAMPER_DETECTION_THRESHOLD &&
    bestResult !== null &&
    bestAsset !== null
  ) {
    // ── RESULT: LIKELY_TAMPERED ──────────────────────────────────────────
    console.log(
      `${tag} ✅ STEP 2 HIT — LIKELY_TAMPERED. ` +
      `Closest match: asset id=${bestAsset.id}, ` +
      `distance=${bestDistance}, ` +
      `similarity=${bestResult.similarityPercent}%, ` +
      `tamperLevel=${bestResult.tamperLevel}`
    );

    return NextResponse.json({
      success: true,
      data: {
        status: "LIKELY_TAMPERED",
        assetId: bestAsset.id,
        hammingDistance: bestResult.distance,
        similarityPercent: bestResult.similarityPercent,
        tamperLevel: bestResult.tamperLevel,
        tamperDescription: bestResult.description,
        matchedAsset: bestAsset,
      } satisfies LikelyTamperedResult,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  STEP 3: NOT REGISTERED
  // ════════════════════════════════════════════════════════════════════════════
  //
  // No SHA-256 match, and no aHash within the similarity threshold.
  // This image has no provenance record in the Nexora system.
  // ─────────────────────────────────────────────────────────────────────────

  console.log(
    `${tag} ── STEP 2 MISS — Best distance ${bestDistance} exceeds threshold ` +
    `${TAMPER_DETECTION_THRESHOLD}. Image not registered.`
  );
  console.log(`${tag} ✅ STEP 3 — NOT_REGISTERED.`);

  return NextResponse.json({
    success: true,
    data: { status: "NOT_REGISTERED" } satisfies NotRegisteredResult,
  });
}

// ─── Method Guard ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST with a multipart/form-data image to verify provenance.",
      },
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
