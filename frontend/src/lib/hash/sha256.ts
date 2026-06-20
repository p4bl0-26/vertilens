/**
 * @file sha256.ts
 * @description Utility for generating a SHA-256 cryptographic hash from a raw Buffer.
 *
 * This is used as the PRIMARY FINGERPRINT for a piece of content. A SHA-256 hash
 * is deterministic and collision-resistant — any single byte change to the input
 * will produce a completely different output hash.
 *
 * Use Case in Nexora:
 *   - Hashing the raw image file buffer before anchoring it on-chain.
 *   - The resulting hex string is what gets written to the Monad smart contract.
 *   - During verification, the same hash is recomputed and compared against the
 *     on-chain record to prove the file has not been modified.
 *
 * NOTE: This is a cryptographic hash, NOT a perceptual hash. It is binary — any
 * modification (even metadata or EXIF data) will produce a completely different
 * result. For fuzzy/visual similarity, see averageHash.ts.
 */

import { createHash } from "crypto";

/**
 * Computes the SHA-256 hash of a given Buffer.
 *
 * @param {Buffer} buffer - The raw binary content of the file to be hashed.
 *                          This should be the complete, unmodified file buffer
 *                          (e.g., from `fs.readFile()` or a multipart upload).
 * @returns {string} A 64-character lowercase hexadecimal string representing
 *                   the 256-bit SHA-256 digest of the input buffer.
 * @throws {TypeError} If the argument is not a valid Buffer instance.
 * @throws {Error} If the underlying crypto module fails to create a hash.
 *
 * @example
 * import { computeSHA256 } from "@/lib/hash/sha256";
 * import { readFileSync } from "fs";
 *
 * const fileBuffer = readFileSync("./image.png");
 * const hash = computeSHA256(fileBuffer);
 * console.log(hash);
 * // => "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
 */
export function computeSHA256(buffer: Buffer): string {
  // --- Input Validation ---
  // Ensure the caller passed a valid Buffer. Passing null, undefined, or a
  // plain string would result in a silent, incorrect hash that is hard to debug.
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(
      `[sha256] Expected a Buffer, but received: ${typeof buffer}. ` +
      `Ensure you are reading the file as a Buffer (e.g., Buffer.from(arrayBuffer)).`
    );
  }

  // Guard against empty buffers. An empty file produces a valid SHA-256 hash
  // (the well-known empty-string digest), but in our context it almost certainly
  // means the caller made a mistake (e.g., an empty upload).
  if (buffer.length === 0) {
    throw new Error(
      "[sha256] Received an empty Buffer. The file may not have been read correctly " +
      "or the upload was empty. Cannot generate a meaningful hash for an empty file."
    );
  }

  // --- Hash Computation ---
  // `createHash` initializes a Hash object using the SHA-256 algorithm.
  // `.update(buffer)` feeds the data into the hash function.
  // `.digest("hex")` finalizes the computation and returns the result as a
  // lowercase hexadecimal string (64 characters for SHA-256).
  try {
    const hash = createHash("sha256").update(buffer).digest("hex");
    return hash;
  } catch (error: unknown) {
    // This catch block handles potential (though very rare) errors from the
    // Node.js crypto module itself, e.g., if the algorithm is unavailable
    // in a restricted runtime environment (like a FIPS-compliant build).
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[sha256] Failed to compute SHA-256 hash. Crypto module error: ${message}`
    );
  }
}
