/**
 * @file ai.ts
 * @description AI provider abstraction layer for the Nexora tamper-detection
 *              explanation service.
 *
 * PROVIDER SELECTION (automatic, priority order):
 *   1. OpenAI (GPT-4o)    — if OPENAI_API_KEY is set in environment
 *   2. Anthropic (Claude) — if ANTHROPIC_API_KEY is set in environment
 *   3. Fallback           — deterministic rule-based explanation if neither is set
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
 *   OPENAI_API_KEY        — OpenAI API key (server-only, no NEXT_PUBLIC_ prefix)
 *   ANTHROPIC_API_KEY     — Anthropic API key (server-only, no NEXT_PUBLIC_ prefix)
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
 * OpenAI model to use. gpt-4o gives the best reasoning for forensic context.
 * Falls back to gpt-4-turbo if 4o is unavailable on the account.
 */
const OPENAI_MODEL = "gpt-4o";

/**
 * Anthropic model to use. claude-3-5-sonnet balances speed and reasoning quality.
 */
const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

// ─── Input / Output Types ─────────────────────────────────────────────────────

/**
 * The input payload sent to POST /api/explain and forwarded to the AI service.
 *
 * Contains ONLY metadata (dimensions, sizes, hashes) — never pixel data.
 * This is intentional: the AI must not "see" the image and invent descriptions.
 */
export interface ExplainInput {
  /**
   * The original registered asset from the provenance database.
   * Used for: width, height, fileSize, sha256, ahash, filename, registeredAt.
   */
  originalAsset: Asset;

  /**
   * Metadata about the uploaded image being verified.
   * Constructed in the explain route from the uploaded file + Sharp metadata.
   * Note: this is a subset of Asset — no id/storagePath since it is not registered.
   */
  uploadedAsset: UploadedAssetMeta;

  /**
   * Number of bits that differ between originalAsset.ahash and uploadedAsset.ahash.
   * Range: 0 (identical) to 256 (completely different).
   */
  hammingDistance: number;

  /**
   * Machine-readable tamper level classification derived from hammingDistance.
   * Used to calibrate the tone of the AI explanation.
   */
  tamperLevel: TamperLevel;
}

/**
 * Metadata about the uploaded image being verified — a partial Asset
 * without database-specific fields (id, storagePath, imageUrl, registeredAt).
 */
export interface UploadedAssetMeta {
  /** Original filename of the uploaded file (e.g., "modified-photo.jpg"). */
  filename: string;

  /** SHA-256 of the uploaded file (did NOT match any registered hash). */
  sha256: string;

  /** Perceptual hash of the uploaded file. */
  ahash: string;

  /** Width in pixels as reported by Sharp. Null if unreadable. */
  width: number | null;

  /** Height in pixels as reported by Sharp. Null if unreadable. */
  height: number | null;

  /** File size in bytes. */
  fileSize: number;

  /** MIME type reported by the browser upload. */
  mimeType: string;
}

/**
 * The output returned by generateTamperExplanation().
 * Consumed directly by the /api/explain route handler response.
 */
export interface ExplainOutput {
  /**
   * A concise forensic explanation of the likely tamper scenario.
   * Written from a cautious forensics perspective — probabilistic language only.
   */
  explanation: string;

  /**
   * Which AI provider generated the explanation.
   * "fallback" means no AI provider was configured — rule-based text was used.
   */
  provider: "openai" | "anthropic" | "fallback";

  /**
   * The model identifier used (e.g., "gpt-4o", "claude-3-5-sonnet-20241022").
   * "rule-based" when the fallback path was taken.
   */
  model: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

/**
 * The system prompt enforces the forensics persona and strict language rules.
 * This is the most important configuration in the entire AI pipeline.
 */
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

/**
 * Builds the structured user prompt from the ExplainInput.
 *
 * Presents all available metadata in a clear, structured format so the AI
 * can make accurate inferences without needing access to the pixel data.
 *
 * @param input - The verification comparison data.
 * @returns A formatted string prompt for the AI model.
 */
function buildUserPrompt(input: ExplainInput): string {
  const { originalAsset, uploadedAsset, hammingDistance, tamperLevel } = input;

  // Compute similarity percentage from Hamming distance (256 bits total for 16x16 aHash)
  const totalBits = 256;
  const similarityPercent = (((totalBits - hammingDistance) / totalBits) * 100).toFixed(2);

  // Compute file size difference
  const sizeDiffBytes = uploadedAsset.fileSize - originalAsset.fileSize;
  const sizeDiffKB = (Math.abs(sizeDiffBytes) / 1024).toFixed(2);
  const sizeDiffSign = sizeDiffBytes > 0 ? "larger" : sizeDiffBytes < 0 ? "smaller" : "identical";

  // Compute dimension changes
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

// ─── Provider: OpenAI ─────────────────────────────────────────────────────────

/**
 * Calls the OpenAI Chat Completions API to generate the tamper explanation.
 *
 * @param prompt - The formatted user prompt from buildUserPrompt().
 * @returns The explanation text from the model.
 * @throws If the API call fails or returns an empty response.
 */
async function callOpenAI(prompt: string): Promise<string> {
  // Dynamic import keeps the SDK out of the bundle when not needed.
  const { default: OpenAI } = await import("openai");

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 20_000, // 20 second timeout — AI calls can be slow
    maxRetries: 1,   // One retry on transient failures
  });

  console.log(`[ai] Calling OpenAI model: ${OPENAI_MODEL}`);

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("[ai:openai] Empty response from model — no content in choices[0].");
  }

  console.log(
    `[ai:openai] Response received. ` +
    `Tokens used: ${response.usage?.total_tokens ?? "unknown"}. ` +
    `Finish reason: ${response.choices[0]?.finish_reason ?? "unknown"}.`
  );

  return content;
}

// ─── Provider: Anthropic ──────────────────────────────────────────────────────

/**
 * Calls the Anthropic Messages API to generate the tamper explanation.
 *
 * @param prompt - The formatted user prompt from buildUserPrompt().
 * @returns The explanation text from the model.
 * @throws If the API call fails or returns an empty response.
 */
async function callAnthropic(prompt: string): Promise<string> {
  // Dynamic import keeps the SDK out of the bundle when not needed.
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 20_000,
    maxRetries: 1,
  });

  console.log(`[ai] Calling Anthropic model: ${ANTHROPIC_MODEL}`);

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: prompt },
    ],
  });

  // Anthropic returns an array of content blocks. Extract the first text block.
  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
    throw new Error("[ai:anthropic] Empty or non-text response from model.");
  }

  console.log(
    `[ai:anthropic] Response received. ` +
    `Input tokens: ${response.usage.input_tokens}, ` +
    `Output tokens: ${response.usage.output_tokens}. ` +
    `Stop reason: ${response.stop_reason ?? "unknown"}.`
  );

  return textBlock.text.trim();
}

// ─── Fallback: Rule-Based Explanation ────────────────────────────────────────

/**
 * Generates a deterministic, rule-based explanation when no AI provider is
 * configured. This ensures the /api/explain endpoint always returns a useful
 * response, even in environments without API keys (e.g., local dev, CI).
 *
 * The text is deliberately written using the same constrained language rules
 * as the AI prompt (probabilistic, no image content descriptions).
 *
 * @param input - The verification comparison data.
 * @returns A plain-text forensic explanation string.
 */
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
      // Distance 0 — should not reach the explain endpoint, but handle gracefully.
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
      // TypeScript exhaustiveness — this should never be reached.
      const _: never = tamperLevel;
      return `Forensic analysis could not be completed for tamper level: ${_}. Manual review required.`;
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a forensic tamper explanation using the best available AI provider.
 *
 * Provider selection:
 *   1. OpenAI    — if OPENAI_API_KEY is set
 *   2. Anthropic — if ANTHROPIC_API_KEY is set
 *   3. Fallback  — rule-based text if neither key is configured
 *
 * The function NEVER throws. All errors are caught internally and result in
 * the fallback explanation being returned. This ensures the /api/explain
 * endpoint always responds, even if the AI provider is down.
 *
 * @param input - The verification comparison input (asset metadata + distance).
 * @returns ExplainOutput with explanation text, provider, and model identifier.
 *
 * @example
 * const result = await generateTamperExplanation({
 *   originalAsset,
 *   uploadedAsset,
 *   hammingDistance: 18,
 *   tamperLevel: "MINOR_EDIT",
 * });
 * console.log(result.explanation);
 * // => "Analysis of the metadata suggests..."
 * console.log(result.provider); // => "openai" | "anthropic" | "fallback"
 */
export async function generateTamperExplanation(
  input: ExplainInput
): Promise<ExplainOutput> {
  const prompt = buildUserPrompt(input);

  console.log(
    `[ai] generateTamperExplanation called. ` +
    `tamperLevel=${input.tamperLevel}, hammingDistance=${input.hammingDistance}. ` +
    `Checking available providers...`
  );

  // ── Provider 1: OpenAI ──────────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    console.log("[ai] OpenAI API key detected. Attempting OpenAI provider...");
    try {
      const explanation = await callOpenAI(prompt);
      console.log("[ai] ✓ OpenAI explanation generated successfully.");
      return { explanation, provider: "openai", model: OPENAI_MODEL };
    } catch (err) {
      // Log and fall through to next provider — never crash the route.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ai] ✗ OpenAI call failed: ${message}. Trying next provider.`);
    }
  } else {
    console.log("[ai] OPENAI_API_KEY not set. Skipping OpenAI.");
  }

  // ── Provider 2: Anthropic ───────────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("[ai] Anthropic API key detected. Attempting Anthropic provider...");
    try {
      const explanation = await callAnthropic(prompt);
      console.log("[ai] ✓ Anthropic explanation generated successfully.");
      return { explanation, provider: "anthropic", model: ANTHROPIC_MODEL };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ai] ✗ Anthropic call failed: ${message}. Falling back to rule-based.`);
    }
  } else {
    console.log("[ai] ANTHROPIC_API_KEY not set. Skipping Anthropic.");
  }

  // ── Provider 3: Fallback ────────────────────────────────────────────────────
  console.log("[ai] Using rule-based fallback explanation.");
  const explanation = generateFallbackExplanation(input);
  console.log("[ai] ✓ Fallback explanation generated.");
  return { explanation, provider: "fallback", model: "rule-based" };
}
