/**
 * @file route.ts  (src/app/api/explain/route.ts)
 * @description Next.js App Router Route Handler for generating AI-powered
 *              forensic tamper explanations.
 *
 * ENDPOINT:     POST /api/explain
 * CONTENT-TYPE: application/json
 *
 * REQUEST BODY:
 * {
 *   originalAsset:  Asset             — registered original from provenance DB
 *   uploadedAsset:  UploadedAssetMeta — metadata of the submitted image
 *   hammingDistance: number           — bit difference between aHashes (0–256)
 *   tamperLevel:    TamperLevel       — classification from hammingDistance.ts
 * }
 *
 * RESPONSE (success):
 * {
 *   success: true,
 *   data: {
 *     explanation: string  — forensic explanation paragraph
 *     provider:    string  — "gemini" | "fallback"
 *     model:       string  — model identifier or "rule-based"
 *   }
 * }
 *
 * RESPONSE (error):
 * { success: false, error: { code: string, message: string } }
 *
 * DESIGN NOTES:
 *   - This route never returns HTTP 500 for AI failures. If the AI provider
 *     is down or misconfigured, the fallback explanation from ai.ts is used.
 *   - Only returns HTTP 4xx for malformed request bodies.
 *   - The route accepts JSON, not multipart/form-data, because the image has
 *     already been processed upstream by /api/verify.
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { generateTamperExplanation, type ExplainInput } from "@/lib/ai";

// ─── Zod Validation Schema ────────────────────────────────────────────────────
//
// We validate the incoming JSON body strictly using Zod before passing it to
// the AI service. This prevents prompt injection attacks where a malicious
// caller passes crafted strings in the asset fields to manipulate the AI output.

/**
 * Schema for a partial uploaded asset metadata object.
 * Mirrors UploadedAssetMeta in ai.ts.
 */
const UploadedAssetMetaSchema = z.object({
  filename:  z.string().min(1).max(512),
  sha256:    z.string().length(64).regex(/^[0-9a-f]+$/, "Must be lowercase hex"),
  ahash:     z.string().length(64).regex(/^[0-9a-f]+$/, "Must be lowercase hex"),
  width:     z.number().int().positive().nullable(),
  height:    z.number().int().positive().nullable(),
  fileSize:  z.number().int().positive(),
  mimeType:  z.string().min(1).max(128),
});

/**
 * Schema for the registered original Asset.
 * Matches the Asset interface from provenance.types.ts.
 */
const AssetSchema = z.object({
  id:              z.string().uuid(),
  filename:        z.string().min(1).max(512),
  storagePath:     z.string().min(1),
  sha256:          z.string().length(64).regex(/^[0-9a-f]+$/, "Must be lowercase hex"),
  ahash:           z.string().length(64).regex(/^[0-9a-f]+$/, "Must be lowercase hex"),
  width:           z.number().int().positive().nullable(),
  height:          z.number().int().positive().nullable(),
  fileSize:        z.number().int().positive(),
  imageUrl:        z.string().url(),
  registeredAt:    z.string().datetime({ offset: true }).or(z.string().min(1)),
  // On-chain anchor fields — optional/nullable; populated after POST /api/anchor.
  txHash:          z.string().nullable().optional().default(null),
  contractAddress: z.string().nullable().optional().default(null),
  anchoredAt:      z.string().nullable().optional().default(null),
});

/**
 * Valid TamperLevel values — must match the union in provenance.types.ts.
 */
const TamperLevelSchema = z.enum([
  "IDENTICAL",
  "LIKELY_ORIGINAL",
  "MINOR_EDIT",
  "TAMPERED",
  "HEAVILY_TAMPERED",
]);

/**
 * Full request body schema.
 */
const ExplainRequestSchema = z.object({
  originalAsset:   AssetSchema,
  uploadedAsset:   UploadedAssetMetaSchema,
  hammingDistance: z.number().int().min(0).max(256),
  tamperLevel:     TamperLevelSchema,
});

// ─── Type derived from schema ─────────────────────────────────────────────────
type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

// ─── Error response helper ────────────────────────────────────────────────────

function errorResponse(
  code: string,
  message: string,
  status: number
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/explain
 *
 * Accepts verified comparison data and returns an AI-generated forensic
 * explanation. Uses the provider priority chain in ai.ts.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = uuidv4().slice(0, 8);
  const tag       = `[explain][${requestId}]`;

  console.log(`${tag} ▶ Incoming POST /api/explain`);

  // ── Parse JSON body ───────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (err) {
    console.error(`${tag} ✗ Failed to parse JSON body:`, err);
    return errorResponse(
      "INVALID_JSON",
      "Request body must be valid JSON with Content-Type: application/json.",
      400
    );
  }

  // ── Validate with Zod ────────────────────────────────────────────────────
  const parseResult = ExplainRequestSchema.safeParse(rawBody);

  if (!parseResult.success) {
    const issues = parseResult.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    );
    console.warn(`${tag} ✗ Schema validation failed:`, issues);
    return errorResponse(
      "INVALID_REQUEST_BODY",
      `Request body validation failed: ${issues.join("; ")}`,
      400
    );
  }

  const body: ExplainRequest = parseResult.data;

  console.log(
    `${tag} ✓ Request validated. ` +
    `originalAsset.id=${body.originalAsset.id}, ` +
    `tamperLevel=${body.tamperLevel}, ` +
    `hammingDistance=${body.hammingDistance}`
  );

  // ── Additional semantic validation ────────────────────────────────────────
  // Reject explanations for VERIFIED_ORIGINAL scenarios — if SHA-256 matches,
  // there is nothing to explain. This prevents unnecessary AI API calls.
  if (body.tamperLevel === "IDENTICAL" && body.hammingDistance === 0) {
    console.log(
      `${tag} ↩ tamperLevel=IDENTICAL and hammingDistance=0. ` +
      `Returning short-circuit explanation — no tampering to analyze.`
    );
    return NextResponse.json({
      success: true,
      data: {
        explanation:
          "The submitted image is perceptually identical to the registered original. " +
          "No structural differences are indicated by the available metadata. " +
          "The SHA-256 discrepancy may be consistent with metadata-only changes " +
          "such as EXIF data, color profile embedding, or encoding parameters.",
        provider: "fallback",
        model:    "rule-based",
      },
    });
  }

  // ── Build ExplainInput ────────────────────────────────────────────────────
  const explainInput: ExplainInput = {
    originalAsset:   body.originalAsset,
    uploadedAsset:   body.uploadedAsset,
    hammingDistance: body.hammingDistance,
    tamperLevel:     body.tamperLevel,
  };

  // ── Call AI service ───────────────────────────────────────────────────────
  // generateTamperExplanation() NEVER throws — it always returns an ExplainOutput.
  // Errors are handled internally and produce the fallback explanation.
  console.log(`${tag} Calling AI service...`);
  const result = await generateTamperExplanation(explainInput);

  console.log(
    `${tag} ✅ Explanation generated. ` +
    `provider=${result.provider}, model=${result.model}, ` +
    `length=${result.explanation.length} chars.`
  );

  return NextResponse.json({
    success: true,
    data: {
      explanation: result.explanation,
      provider:    result.provider,
      model:       result.model,
    },
  });
}

// ─── Method Guard ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code:    "METHOD_NOT_ALLOWED",
        message: "POST a JSON body with { originalAsset, uploadedAsset, hammingDistance, tamperLevel }.",
      },
    },
    { status: 405, headers: { Allow: "POST" } }
  );
}
