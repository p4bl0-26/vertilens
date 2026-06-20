/**
 * @file route.ts  (src/app/api/register/route.ts)
 * @description Next.js App Router Route Handler for registering (uploading) a new
 *              digital asset into the Nexora provenance system.
 *
 * ENDPOINT:   POST /api/register
 * CONTENT:    multipart/form-data
 * FIELD:      "image" — the image file to register
 *
 * FULL PROCESSING PIPELINE:
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Parse the incoming multipart/form-data request
 *  2. Validate the "image" field exists and is a supported image type
 *  3. Convert the File to a Node.js Buffer (required by Sharp & crypto)
 *  4. Run Sharp to extract image metadata (dimensions, format)
 *  5. Compute SHA-256 hash of the raw file buffer       → exact fingerprint
 *  6. Compute average perceptual hash (aHash)           → fuzzy fingerprint
 *  7. Check for duplicate SHA-256 in Supabase (idempotency guard)
 *  8. Upload the original file to Supabase Storage bucket "assets/originals/"
 *  9. Insert asset metadata row into the Supabase `assets` table
 * 10. Return assetId, sha256, ahash, and the public image URL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RESPONSE SHAPE (success):
 * {
 *   success: true,
 *   data: {
 *     assetId:  string,   // UUID of the newly created asset record
 *     sha256:   string,   // 64-char SHA-256 hex (to be anchored on Monad)
 *     ahash:    string,   // 64-char perceptual hash hex
 *     imageUrl: string    // Public Supabase Storage URL
 *   }
 * }
 *
 * RESPONSE SHAPE (error):
 * { success: false, error: { code: string, message: string } }
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { computeSHA256 } from "@/lib/hash/sha256";
import { computeAverageHash } from "@/lib/hash/averageHash";
import {
  createAdminClient,
  getPublicStorageUrl,
  STORAGE_BUCKET,
  STORAGE_FOLDER_ORIGINALS,
  type AssetInsert,
} from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum allowed upload size in bytes.
 * 20 MB is generous for a provenance demo; tighten this in production.
 */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Allowlist of MIME types we accept for provenance registration.
 * We explicitly reject anything that is not a raster image to avoid
 * Sharp processing errors and security issues (e.g., SVG injection).
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

// ─── Type Definitions ─────────────────────────────────────────────────────────

/** Shape of the successful response payload. */
interface RegisterSuccessPayload {
  assetId: string;
  sha256: string;
  ahash: string;
  imageUrl: string;
}

/** Standardised error envelope. */
interface ErrorPayload {
  code: string;
  message: string;
}

// ─── Helper: Build error response ────────────────────────────────────────────

/**
 * Creates a standardised JSON error response.
 *
 * @param code    - A machine-readable snake_case error code for the frontend.
 * @param message - A human-readable description safe to display to the user.
 * @param status  - HTTP status code (4xx or 5xx).
 */
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
 * POST /api/register
 *
 * Accepts a multipart/form-data body with a single "image" field.
 * Runs the full pipeline described in the file header and returns the
 * asset identifiers needed for on-chain anchoring.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: true; data: RegisterSuccessPayload } | { success: false; error: ErrorPayload }>> {

  const requestId = uuidv4().slice(0, 8); // Short ID for correlating log lines
  const tag = `[register][${requestId}]`;

  console.log(`${tag} ▶ Incoming POST /api/register`);
  console.log(`${tag} Content-Type: ${request.headers.get("content-type") ?? "none"}`);

  // ── Step 1: Parse multipart/form-data ──────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error(`${tag} ✗ Failed to parse FormData:`, err);
    return errorResponse(
      "INVALID_FORM_DATA",
      "Request body could not be parsed as multipart/form-data. " +
      "Ensure Content-Type is multipart/form-data and the body is well-formed.",
      400
    );
  }

  // ── Step 2a: Extract the "image" field ─────────────────────────────────────
  const imageField = formData.get("image");

  if (!imageField) {
    console.warn(`${tag} ✗ Missing "image" field in FormData`);
    return errorResponse(
      "MISSING_IMAGE_FIELD",
      'No "image" field found in the form data. ' +
      'Include the image file as a field named "image".',
      400
    );
  }

  // The FormData "image" field must be a File object, not a plain string.
  if (!(imageField instanceof File)) {
    console.warn(`${tag} ✗ "image" field is not a File — got: ${typeof imageField}`);
    return errorResponse(
      "INVALID_IMAGE_FIELD",
      '"image" must be a file upload (File/Blob), not a plain string.',
      400
    );
  }

  const originalFile = imageField as File;

  console.log(
    `${tag} File received: name="${originalFile.name}", ` +
    `type="${originalFile.type}", size=${originalFile.size} bytes`
  );

  // ── Step 2b: Validate MIME type ────────────────────────────────────────────
  // We check the MIME type reported by the browser. This is NOT a complete
  // security check (MIME types can be spoofed), but Sharp will fail safely
  // if the file is corrupt or not a real image.
  if (!ACCEPTED_MIME_TYPES.has(originalFile.type)) {
    console.warn(`${tag} ✗ Unsupported MIME type: "${originalFile.type}"`);
    return errorResponse(
      "UNSUPPORTED_IMAGE_TYPE",
      `File type "${originalFile.type}" is not supported. ` +
      `Accepted types: ${[...ACCEPTED_MIME_TYPES].join(", ")}.`,
      415
    );
  }

  // ── Step 2c: Validate file size ────────────────────────────────────────────
  if (originalFile.size === 0) {
    console.warn(`${tag} ✗ Empty file uploaded`);
    return errorResponse("EMPTY_FILE", "The uploaded file is empty (0 bytes).", 400);
  }

  if (originalFile.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (originalFile.size / 1024 / 1024).toFixed(2);
    const maxMB = (MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0);
    console.warn(`${tag} ✗ File too large: ${sizeMB} MB (max: ${maxMB} MB)`);
    return errorResponse(
      "FILE_TOO_LARGE",
      `File size ${sizeMB} MB exceeds the maximum allowed size of ${maxMB} MB.`,
      413
    );
  }

  // ── Step 3: Convert File → Node.js Buffer ──────────────────────────────────
  // Next.js Route Handlers use the Web Streams API (File/Blob) not Node's Buffer.
  // Sharp and Node's crypto both require a Buffer, so we convert here.
  let fileBuffer: Buffer;
  try {
    const arrayBuffer = await originalFile.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    console.log(`${tag} ✓ Converted File to Buffer (${fileBuffer.length} bytes)`);
  } catch (err) {
    console.error(`${tag} ✗ Failed to read file into Buffer:`, err);
    return errorResponse(
      "FILE_READ_ERROR",
      "Failed to read the uploaded file. The file may be corrupt or the upload was interrupted.",
      500
    );
  }

  // ── Step 4: Extract image metadata using Sharp ─────────────────────────────
  // Sharp reads the image headers to extract width, height, and format.
  // This also serves as a second-pass validation — if Sharp can't parse it,
  // it was not a valid image regardless of what the MIME type said.
  let imageWidth: number | undefined;
  let imageHeight: number | undefined;
  let imageFormat: string | undefined;

  try {
    const sharpMetadata = await sharp(fileBuffer).metadata();
    imageWidth = sharpMetadata.width;
    imageHeight = sharpMetadata.height;
    imageFormat = sharpMetadata.format;

    console.log(
      `${tag} ✓ Sharp metadata: format=${imageFormat}, ` +
      `dimensions=${imageWidth ?? "?"}x${imageHeight ?? "?"}`
    );
  } catch (err) {
    console.error(`${tag} ✗ Sharp failed to read image metadata:`, err);
    return errorResponse(
      "INVALID_IMAGE_DATA",
      "The uploaded file could not be processed as an image. " +
      "It may be corrupt, truncated, or contain an unsupported encoding.",
      422
    );
  }

  // ── Step 5: Compute SHA-256 fingerprint ────────────────────────────────────
  let sha256: string;
  try {
    sha256 = computeSHA256(fileBuffer);
    console.log(`${tag} ✓ SHA-256: ${sha256}`);
  } catch (err) {
    console.error(`${tag} ✗ SHA-256 computation failed:`, err);
    return errorResponse(
      "HASH_COMPUTATION_ERROR",
      "Failed to compute the SHA-256 fingerprint of the image.",
      500
    );
  }

  // ── Step 6: Compute perceptual average hash (aHash) ────────────────────────
  let ahash: string;
  try {
    ahash = await computeAverageHash(fileBuffer);
    console.log(`${tag} ✓ aHash: ${ahash}`);
  } catch (err) {
    console.error(`${tag} ✗ aHash computation failed:`, err);
    return errorResponse(
      "PERCEPTUAL_HASH_ERROR",
      "Failed to compute the perceptual hash of the image.",
      500
    );
  }

  // ── Initialise Supabase admin client ───────────────────────────────────────
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
    console.log(`${tag} ✓ Supabase admin client created`);
  } catch (err) {
    console.error(`${tag} ✗ Failed to create Supabase client:`, err);
    return errorResponse(
      "SUPABASE_CONFIG_ERROR",
      "Server configuration error. The database client could not be initialised.",
      500
    );
  }

  // ── Step 7: Idempotency check — reject duplicate SHA-256 ──────────────────
  // If the exact same file has already been registered (same SHA-256),
  // we return the existing record instead of creating a duplicate.
  // This prevents the same content from being double-anchored on-chain.
  console.log(`${tag} Checking for duplicate SHA-256 in assets table...`);
  const { data: existingAsset, error: lookupError } = await supabase
    .from("assets")
    .select("id, sha256, ahash, storage_path")
    .eq("sha256", sha256)
    .maybeSingle(); // Returns null (not error) if no row found

  if (lookupError) {
    console.error(`${tag} ✗ Supabase lookup error:`, lookupError);
    return errorResponse(
      "DB_LOOKUP_ERROR",
      "Failed to check for existing asset in the database.",
      500
    );
  }

  if (existingAsset) {
    console.log(
      `${tag} ↩ Duplicate detected. Asset already registered: id=${existingAsset.id}`
    );
    const imageUrl = getPublicStorageUrl(supabase, existingAsset.storage_path);
    // Return 200 (not 409) so the frontend can proceed to on-chain anchoring
    // with the existing asset's data if needed.
    return NextResponse.json({
      success: true,
      data: {
        assetId: existingAsset.id,
        sha256: existingAsset.sha256,
        ahash: existingAsset.ahash,
        imageUrl,
      },
    });
  }

  console.log(`${tag} ✓ No duplicate found. Proceeding with registration.`);

  // ── Step 8: Upload original image to Supabase Storage ──────────────────────
  // Generate a UUID-based filename to avoid collisions and sanitise the filename.
  // We preserve the original extension for correct MIME handling by CDNs.
  const fileExtension = originalFile.name.split(".").pop()?.toLowerCase() ?? imageFormat ?? "jpg";
  const storageFilename = `${uuidv4()}.${fileExtension}`;
  const storagePath = `${STORAGE_FOLDER_ORIGINALS}/${storageFilename}`;

  console.log(`${tag} Uploading to Supabase Storage: bucket="${STORAGE_BUCKET}", path="${storagePath}"`);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: originalFile.type,
      // `upsert: false` means the upload will fail if the path already exists.
      // Since we generate a UUID filename, collisions are astronomically unlikely.
      upsert: false,
      // Cache the image in CDN for 1 year — originals are immutable by design.
      cacheControl: "31536000",
    });

  if (uploadError) {
    console.error(`${tag} ✗ Supabase Storage upload failed:`, uploadError);
    return errorResponse(
      "STORAGE_UPLOAD_ERROR",
      `Failed to upload image to storage: ${uploadError.message}`,
      500
    );
  }

  console.log(`${tag} ✓ Image uploaded to storage successfully.`);

  // Construct the public CDN URL for the uploaded image.
  const imageUrl = getPublicStorageUrl(supabase, storagePath);
  console.log(`${tag} Public image URL: ${imageUrl}`);

  // ── Step 9: Insert metadata row into the `assets` table ────────────────────
  const assetInsert: AssetInsert = {
    filename: originalFile.name,
    storage_path: storagePath,
    sha256,
    ahash,
    width: imageWidth ?? null,
    height: imageHeight ?? null,
    file_size: originalFile.size,
  };

  console.log(`${tag} Inserting asset metadata into DB:`, {
    ...assetInsert,
    sha256: `${sha256.slice(0, 8)}...`, // Truncate in logs for readability
    ahash: `${ahash.slice(0, 8)}...`,
  });

  const { data: insertedAsset, error: insertError } = await supabase
    .from("assets")
    .insert([assetInsert])
    .select("id") // Only return the generated UUID, we have everything else
    .single();

  if (insertError || !insertedAsset) {
    console.error(`${tag} ✗ Supabase DB insert failed:`, insertError);

    // Attempt to clean up the uploaded file to avoid orphaned storage objects.
    // Best-effort: log but don't surface the cleanup error to the caller.
    console.log(`${tag} Attempting storage cleanup for orphaned file: ${storagePath}`);
    const { error: cleanupError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (cleanupError) {
      console.error(`${tag} ✗ Storage cleanup also failed:`, cleanupError);
    } else {
      console.log(`${tag} ✓ Orphaned file removed from storage.`);
    }

    return errorResponse(
      "DB_INSERT_ERROR",
      `Failed to save asset metadata to the database: ${insertError?.message ?? "Unknown error"}`,
      500
    );
  }

  // ── Step 10: Return success payload ────────────────────────────────────────
  console.log(
    `${tag} ✅ Asset registered successfully! id=${insertedAsset.id}, ` +
    `sha256=${sha256.slice(0, 8)}..., url=${imageUrl.slice(0, 60)}...`
  );

  return NextResponse.json({
    success: true,
    data: {
      assetId: insertedAsset.id,
      sha256,
      ahash,
      imageUrl,
    },
  });
}

// ─── Method Guard ─────────────────────────────────────────────────────────────
// Explicitly reject all non-POST methods with a clear error.
// Next.js will return 405 automatically for unhandled methods, but this
// provides a more descriptive response body for API consumers.

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST to register an image." } },
    { status: 405, headers: { Allow: "POST" } }
  );
}
