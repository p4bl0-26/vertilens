/**
 * @file averageHash.ts
 * @description Generates a 256-bit perceptual (average) hash from an image buffer
 *              using the Sharp image processing library.
 *
 * HOW PERCEPTUAL HASHING WORKS (aHash algorithm):
 * Unlike a cryptographic hash (SHA-256), a perceptual hash is designed to be
 * SIMILAR for visually similar images. Minor edits (cropping a few pixels,
 * brightness changes, JPEG re-compression) will produce a hash that is close
 * to the original, but not identical. The difference can be measured with
 * Hamming Distance (see hammingDistance.ts).
 *
 * ALGORITHM STEPS:
 *   1. Resize the image to a small fixed size (16x16 = 256 pixels). This
 *      removes high-frequency detail and normalizes for scale/aspect ratio.
 *   2. Convert to grayscale. This removes color information so the hash is
 *      purely based on luminance/structure.
 *   3. Extract the raw pixel buffer (one byte per pixel, 0-255).
 *   4. Compute the mean (average) luminance of all 256 pixels.
 *   5. For each pixel: if pixel >= mean, set bit to 1, otherwise 0.
 *   6. Pack the 256 bits into a 64-character hex string (256 / 4 bits per hex char).
 *
 * Use Case in Nexora:
 *   - Detecting tampered images that have been visually modified (cropped,
 *     color-graded, or had objects added/removed).
 *   - A Hamming Distance of 0-10 out of 256 bits = likely the same image.
 *   - A distance > 40 typically indicates significant visual differences.
 *
 * @requires sharp - "npm install sharp" or "npm install --save-dev @types/sharp"
 */

import sharp from "sharp";

/**
 * The fixed resolution used for hashing. 16x16 = 256 pixels.
 * This is the industry-standard size for the aHash algorithm.
 * Smaller = faster but less discriminating. Larger = more sensitive but slower.
 */
const HASH_SIZE = 16;

/**
 * The total number of pixels (and therefore bits) in the hash.
 * Must equal HASH_SIZE * HASH_SIZE.
 */
const TOTAL_PIXELS = HASH_SIZE * HASH_SIZE; // 256

/**
 * Generates a 256-bit perceptual average hash (aHash) from an image Buffer.
 *
 * The resulting hash is resilient to minor visual modifications like:
 *   - JPEG/WEBP re-compression artifacts
 *   - Minor brightness/contrast adjustments
 *   - Slight scaling or aspect ratio changes
 *
 * It WILL detect significant changes like:
 *   - Cropping
 *   - Adding/removing objects
 *   - Major color grading
 *   - Flipping/rotating
 *
 * @param {Buffer} imageBuffer - The raw binary content of the image file.
 *                               Supports any format Sharp can process:
 *                               JPEG, PNG, WEBP, AVIF, GIF, TIFF, etc.
 * @returns {Promise<string>} A 64-character lowercase hexadecimal string
 *                            representing the 256-bit perceptual hash.
 * @throws {TypeError} If the input is not a valid Buffer.
 * @throws {Error} If the image cannot be processed by Sharp (e.g., corrupt file,
 *                 unsupported format, or unexpected pixel buffer size).
 *
 * @example
 * import { computeAverageHash } from "@/lib/hash/averageHash";
 * import { readFileSync } from "fs";
 *
 * const imageBuffer = readFileSync("./photo.jpg");
 * const hash = await computeAverageHash(imageBuffer);
 * console.log(hash);
 * // => "f8f0e0c0808080807f7f1f0f070301ff" (example — 64 hex chars)
 */
export async function computeAverageHash(imageBuffer: Buffer): Promise<string> {
  // --- Input Validation ---
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new TypeError(
      `[averageHash] Expected a Buffer, but received: ${typeof imageBuffer}. ` +
      `Pass the raw file content as a Node.js Buffer.`
    );
  }

  if (imageBuffer.length === 0) {
    throw new Error(
      "[averageHash] Received an empty Buffer. The image file may not have been " +
      "read correctly or the upload stream was empty."
    );
  }

  // --- Step 1 & 2: Resize to 16x16 and convert to grayscale ---
  // Sharp processes the image in a pipeline. We chain operations before
  // calling `.raw()` to get the decompressed pixel data.
  //
  // Options explained:
  //   - `fit: "fill"`: Stretch/squish to exactly 16x16, ignoring aspect ratio.
  //     This is intentional — we want a fixed 256-pixel grid, not letterboxing.
  //   - `grayscale()`: Converts to a single-channel (luma) image. This ensures
  //     `channels = 1` in the raw output, giving exactly TOTAL_PIXELS bytes.
  let rawPixelBuffer: Buffer;
  let metadata: sharp.OutputInfo;

  try {
    const result = await sharp(imageBuffer)
      .resize(HASH_SIZE, HASH_SIZE, { fit: "fill" })
      .grayscale()
      .raw() // Get uncompressed pixel bytes — no PNG/JPEG headers, just values
      .toBuffer({ resolveWithObject: true }); // Get buffer AND metadata together

    rawPixelBuffer = result.data;
    metadata = result.info;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[averageHash] Sharp failed to process the image. It may be corrupt, ` +
      `an unsupported format, or too small. Sharp error: ${message}`
    );
  }

  // --- Sanity Check: Validate the pixel buffer ---
  // After grayscale resize, we must have exactly HASH_SIZE * HASH_SIZE bytes.
  // If this fails, something went wrong with the Sharp pipeline.
  if (rawPixelBuffer.length !== TOTAL_PIXELS) {
    throw new Error(
      `[averageHash] Unexpected pixel buffer size after Sharp processing. ` +
      `Expected ${TOTAL_PIXELS} bytes (${HASH_SIZE}x${HASH_SIZE} grayscale), ` +
      `but got ${rawPixelBuffer.length} bytes. ` +
      `Image info: ${metadata.width}x${metadata.height}, channels: ${metadata.channels}.`
    );
  }

  // --- Step 3: Extract pixel values into a typed array ---
  // `rawPixelBuffer` is a Buffer of unsigned 8-bit integers.
  // Convert to Uint8Array for efficient typed-array iteration.
  const pixels = new Uint8Array(rawPixelBuffer);

  // --- Step 4: Compute mean pixel luminance ---
  // Sum all pixel values (0–255) and divide by the pixel count.
  // This gives us the "average brightness" threshold for the bit-setting step.
  let sum = 0;
  for (let i = 0; i < TOTAL_PIXELS; i++) {
    sum += pixels[i];
  }
  const mean = sum / TOTAL_PIXELS;

  // --- Step 5: Generate the bit array ---
  // For each pixel, compare its value to the mean:
  //   - Pixel >= mean → bit = 1 (brighter than average)
  //   - Pixel < mean  → bit = 0 (darker than average)
  // This encodes the relative structure of the image as a binary fingerprint.
  const bits: number[] = new Array(TOTAL_PIXELS);
  for (let i = 0; i < TOTAL_PIXELS; i++) {
    bits[i] = pixels[i] >= mean ? 1 : 0;
  }

  // --- Step 6: Pack bits into a hex string ---
  // We process 4 bits at a time to produce one hex character (nibble).
  // This gives us 256 bits / 4 = 64 hex characters.
  //
  // Example: bits [1, 0, 1, 1] → binary "1011" → decimal 11 → hex "b"
  let hexHash = "";
  for (let i = 0; i < TOTAL_PIXELS; i += 4) {
    // Shift and OR the 4 bits into a nibble value (0-15)
    const nibble =
      (bits[i]     << 3) | // Most significant bit of the nibble
      (bits[i + 1] << 2) |
      (bits[i + 2] << 1) |
      (bits[i + 3]);        // Least significant bit of the nibble

    // Convert nibble to a single hex character and append
    hexHash += nibble.toString(16);
  }

  // Final validation: the output must always be exactly 64 hex characters.
  if (hexHash.length !== TOTAL_PIXELS / 4) {
    throw new Error(
      `[averageHash] Internal error: Generated hash has unexpected length ` +
      `${hexHash.length}, expected ${TOTAL_PIXELS / 4}. This is a bug.`
    );
  }

  return hexHash;
}
