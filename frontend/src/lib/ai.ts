/**
 * @file ai.ts
 * @description AI provider abstraction layer for the Veritas tamper-detection
 *              explanation service.
 *
 * PROVIDER SELECTION:
 *   1. Google Gemini (gemini-2.5-flash) — if GEMINI_API_KEY is set in environment
 *   2. Fallback                         — deterministic rule-based explanation
 *
 * This file exposes a single public function:
 *   generateTamperExplanation(input: ExplainInput): Promise<ExplainOutput>
 *
 * SYSTEM PROMPT RULES (enforced at the prompt level, not in code):
 *   ✅ Allowed:  "likely", "may indicate", "consistent with", "suggests"
 *   ❌ Forbidden: "definitely", "certainly", "proven", "guaranteed"
 *   ❌ Never describe image contents
 *   ❌ Never invent visual details
 *   ❌ Reason ONLY from: dimensions, file size, hamming distance, perceptual hash similarity
 *
 * ENVIRONMENT VARIABLES:
 *   GEMINI_API_KEY        — Google Gemini API key (server-only, no NEXT_PUBLIC_ prefix)
 *   AI_MAX_TOKENS         — Optional. Max tokens for the AI response (default: 400)
 *   AI_TEMPERATURE        — Optional. Model temperature 0.0–1.0 (default: 0.4)
 */

import type { TamperLevel, Asset } from "@nexora/shared-types/provenance.types";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum number of tokens the AI model may generate in its response.
 * Kept short — we only need a concise forensic paragraph, not an essay.
 */
const MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS ?? "400", 10);

/**
 * Temperature controls randomness. Lower = more deterministic and factual.
 * 0.4 gives consistent, measured language without being robotic.
 */
const TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE ?? "0.4");

/**
 * Gemini model to use. gemini-2.5-flash gives the best reasoning speed and quality for forensic context.
 */
const GEMINI_MODEL = "gemini-2.5-flash";

// ─── Input / Output Types ─────────────────────────────────────────────────────

export interface ExplainInput {
  originalAsset: Asset;
  uploadedAsset: UploadedAssetMeta;
  hammingDistance: number;
  tamperLevel: TamperLevel;
}

export interface UploadedAssetMeta {
  filename: string;
  sha256: string;
  ahash: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  mimeType: string;
}

export interface ExplainOutput {
  explanation: string;
  provider: "gemini" | "fallback";
  model: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a digital forensics assistant specializing in image authenticity analysis.

Your role is to analyze metadata differences between a registered original image and a submitted image, and provide a concise forensic assessment.

STRICT RULES — you MUST follow these at all times:
1. NEVER describe image contents, subjects, or visual elements. You cannot see the image.
2. NEVER claim certainty about what happened. You are reasoning from metadata only.
3. NEVER invent or speculate about visual details not present in the metadata.
4. ONLY reason from: file dimensions, file size, SHA-256 hash, perceptual hash (aHash), and Hamming Distance.
5. ALWAYS use probabilistic language.

REQUIRED vocabulary (use these words and phrases):
- "likely", "may indicate", "consistent with", "suggests", "could be"
- "analysis of the metadata", "perceptual similarity", "structural differences"

FORBIDDEN vocabulary (never use these):
- "definitely", "certainly", "proven", "guaranteed", "clearly", "obviously"
- "the image shows", "I can see", "visually", "appears to contain"

OUTPUT FORMAT:
- Write 2–4 sentences maximum.
- Be precise and technical, not verbose.
- End with a confidence qualifier (e.g., "however, further forensic review is recommended").
- Do NOT include headers, bullet points, or markdown. Plain text only.`;

// ─── User Prompt Builder ──────────────────────────────────────────────────────

function buildUserPrompt(input: ExplainInput): string {
  const { originalAsset, uploadedAsset, hammingDistance, tamperLevel } = input;

  const totalBits = 256;
  const similarityPercent = (((totalBits - hammingDistance) / totalBits) * 100).toFixed(2);

  const sizeDiffBytes = uploadedAsset.fileSize - originalAsset.fileSize;
  const sizeDiffKB = (Math.abs(sizeDiffBytes) / 1024).toFixed(2);
  const sizeDiffSign = sizeDiffBytes > 0 ? "larger" : sizeDiffBytes < 0 ? "smaller" : "identical";

  const widthChanged =
    originalAsset.width !== null &&
    uploadedAsset.width !== null &&
    originalAsset.width !== uploadedAsset.width;
  const heightChanged =
    originalAsset.height !== null &&
    uploadedAsset.height !== null &&
    originalAsset.height !== uploadedAsset.height;

  return `Analyze the following metadata comparison between a registered original and a submitted image:

REGISTERED ORIGINAL:
  - Filename:     ${originalAsset.filename}
  - Dimensions:   ${originalAsset.width ?? "unknown"} × ${originalAsset.height ?? "unknown"} px
  - File size:    ${(originalAsset.fileSize / 1024).toFixed(2)} KB
  - SHA-256:      ${originalAsset.sha256.slice(0, 16)}... (truncated)
  - aHash:        ${originalAsset.ahash}
  - Registered:   ${originalAsset.registeredAt}

SUBMITTED IMAGE:
  - Filename:     ${uploadedAsset.filename}
  - Dimensions:   ${uploadedAsset.width ?? "unknown"} × ${uploadedAsset.height ?? "unknown"} px
  - File size:    ${(uploadedAsset.fileSize / 1024).toFixed(2)} KB (${sizeDiffKB} KB ${sizeDiffSign} than original)
  - SHA-256:      ${uploadedAsset.sha256.slice(0, 16)}... (truncated, does NOT match original)
  - aHash:        ${uploadedAsset.ahash}
  - MIME type:    ${uploadedAsset.mimeType}

COMPARISON RESULTS:
  - SHA-256 match:       NO (files are not byte-identical)
  - Hamming Distance:    ${hammingDistance} / ${totalBits} bits differ
  - Perceptual similarity: ${similarityPercent}%
  - Tamper classification: ${tamperLevel}
  - Dimension change:    ${widthChanged || heightChanged ? `YES — original ${originalAsset.width}×${originalAsset.height} px vs submitted ${uploadedAsset.width}×${uploadedAsset.height} px` : "NO — dimensions are identical"}

Based solely on the metadata above, provide a brief forensic assessment of what may have occurred to this image.`;
}

// ─── Provider: Gemini ─────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  console.log(`[ai] Calling Gemini model: ${GEMINI_MODEL}`);

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
    },
  });

  const content = response.text?.trim();

  if (!content) {
    throw new Error("[ai:gemini] Empty response from model.");
  }

  console.log(`[ai:gemini] Response received.`);

  return content;
}

// ─── Fallback: Rule-Based Explanation ────────────────────────────────────────

function generateFallbackExplanation(input: ExplainInput): string {
  const { originalAsset, uploadedAsset, hammingDistance, tamperLevel } = input;

  const totalBits = 256;
  const similarityPercent = (((totalBits - hammingDistance) / totalBits) * 100).toFixed(1);

  const sizeDiffBytes = Math.abs(uploadedAsset.fileSize - originalAsset.fileSize);
  const sizeDiffKB    = (sizeDiffBytes / 1024).toFixed(1);

  const dimensionsChanged =
    (originalAsset.width !== null && uploadedAsset.width !== null && originalAsset.width !== uploadedAsset.width) ||
    (originalAsset.height !== null && uploadedAsset.height !== null && originalAsset.height !== uploadedAsset.height);

  switch (tamperLevel) {
    case "IDENTICAL":
      return (
        `The submitted image is perceptually identical to the registered original ` +
        `(Hamming Distance: ${hammingDistance}/256, ${similarityPercent}% similarity). ` +
        `The SHA-256 mismatch may be consistent with metadata or EXIF data differences rather than pixel-level modification. ` +
        `No evidence of content alteration is suggested by the available metadata.`
      );

    case "LIKELY_ORIGINAL":
      return (
        `Analysis of the metadata suggests the submitted image is likely a re-encoded or re-compressed version of the registered original ` +
        `(Hamming Distance: ${hammingDistance}/256, ${similarityPercent}% perceptual similarity). ` +
        `A file size difference of ${sizeDiffKB} KB may indicate a change in compression settings or format conversion. ` +
        `No significant structural alteration is indicated, however further forensic review is recommended.`
      );

    case "MINOR_EDIT":
      return (
        `The metadata comparison indicates minor structural differences that may be consistent with a slight crop, ` +
        `brightness adjustment, or format conversion ` +
        `(Hamming Distance: ${hammingDistance}/256, ${similarityPercent}% perceptual similarity). ` +
        `${dimensionsChanged ? `A change in dimensions from ${originalAsset.width}×${originalAsset.height} to ${uploadedAsset.width}×${uploadedAsset.height} px further suggests spatial modification. ` : ""}` +
        `Manual review is recommended to rule out intentional content alteration.`
      );

    case "TAMPERED":
      return (
        `Significant metadata discrepancies suggest the submitted image may have been substantially altered ` +
        `(Hamming Distance: ${hammingDistance}/256, ${similarityPercent}% perceptual similarity). ` +
        `${dimensionsChanged ? `The dimensional change from ${originalAsset.width}×${originalAsset.height} to ${uploadedAsset.width}×${uploadedAsset.height} px, combined with a ${sizeDiffKB} KB file size difference, ` : `A file size difference of ${sizeDiffKB} KB `}` +
        `is consistent with content modification such as cropping, region replacement, or addition of new elements. ` +
        `This content should be treated as potentially tampered pending further investigation.`
      );

    case "HEAVILY_TAMPERED":
      return (
        `The metadata analysis reveals severe structural divergence from the registered original ` +
        `(Hamming Distance: ${hammingDistance}/256, ${similarityPercent}% perceptual similarity). ` +
        `This level of perceptual hash difference is consistent with major content replacement, ` +
        `substantial compositing, or the submission of a fundamentally different image as a substitute. ` +
        `The available evidence strongly suggests deliberate tampering, however formal forensic analysis is required to confirm.`
      );

    default: {
      const _: never = tamperLevel;
      return `Forensic analysis could not be completed for tamper level: ${_}. Manual review required.`;
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateTamperExplanation(
  input: ExplainInput
): Promise<ExplainOutput> {
  const prompt = buildUserPrompt(input);

  console.log(
    `[ai] generateTamperExplanation called. ` +
    `tamperLevel=${input.tamperLevel}, hammingDistance=${input.hammingDistance}. ` +
    `Checking available providers...`
  );

  // ── Provider 1: Gemini ──────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    console.log("[ai] Gemini API key detected. Attempting Gemini provider...");
    try {
      const explanation = await callGemini(prompt);
      console.log("[ai] ✓ Gemini explanation generated successfully.");
      return { explanation, provider: "gemini", model: GEMINI_MODEL };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ai] ✗ Gemini call failed: ${message}. Falling back to rule-based.`);
    }
  } else {
    console.log("[ai] GEMINI_API_KEY not set. Skipping Gemini.");
  }

  // ── Provider 2: Fallback ────────────────────────────────────────────────────
  console.log("[ai] Using rule-based fallback explanation.");
  const explanation = generateFallbackExplanation(input);
  console.log("[ai] ✓ Fallback explanation generated.");
  return { explanation, provider: "fallback", model: "rule-based" };
}
