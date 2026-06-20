const sharp = require('sharp');
const fs = require('fs');

const HASH_SIZE = 16;
const TOTAL_PIXELS = HASH_SIZE * HASH_SIZE;
const THRESHOLD = 70;

async function computeAverageHash(imageBuffer) {
  const result = await sharp(imageBuffer)
    .resize(HASH_SIZE, HASH_SIZE, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(result.data);
  let sum = 0;
  for (let i = 0; i < TOTAL_PIXELS; i++) { sum += pixels[i]; }
  const mean = sum / TOTAL_PIXELS;

  const bits = new Array(TOTAL_PIXELS);
  for (let i = 0; i < TOTAL_PIXELS; i++) { bits[i] = pixels[i] >= mean ? 1 : 0; }

  let hexHash = "";
  for (let i = 0; i < TOTAL_PIXELS; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | (bits[i + 3]);
    hexHash += nibble.toString(16);
  }
  return hexHash;
}

const POPCOUNT_NIBBLE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

function computeHammingDistance(hashA, hashB) {
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    distance += POPCOUNT_NIBBLE[parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16)];
  }
  return distance;
}

function classifyDistance(distance) {
  if (distance === 0) return "AUTHENTIC";
  if (distance <= THRESHOLD) return "LIKELY_TAMPERED";
  return "NOT_FOUND";
}

async function generateTestImages() {
  const originalPath = 'public/logo.png';
  const metadata = await sharp(originalPath).metadata();
  const width = metadata.width || 400;
  const height = metadata.height || 400;

  // 1. Cropped Image
  await sharp(originalPath)
    .extract({ width: Math.floor(width * 0.75), height: Math.floor(height * 0.75), left: Math.floor(width * 0.1), top: Math.floor(height * 0.1) })
    .toFile('test_1_crop.png');

  // 2. Resized Image
  await sharp(originalPath)
    .resize(Math.floor(width * 0.5), Math.floor(height * 0.5))
    .toFile('test_2_resize.png');

  // 3. Watermarked Image (Composite a red square over it as a mock watermark)
  await sharp(originalPath)
    .composite([{
      input: await sharp({ create: { width: 100, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer(),
      gravity: 'southeast'
    }])
    .toFile('test_3_watermark.png');

  // 4. Brightness Adjusted Image
  await sharp(originalPath)
    .modulate({ brightness: 1.5 })
    .toFile('test_4_brightness.png');

  // 5. Unrelated Images (5 completely different generated images)
  const colors = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 255, b: 0 },
    { r: 255, g: 0, b: 255 }
  ];
  
  for (let i = 0; i < 5; i++) {
    await sharp({ create: { width: width, height: height, channels: 3, background: colors[i] } })
      // add some noise/gradient by compositing so they aren't uniform
      .composite([{
         input: await sharp({ create: { width: width/2, height: height/2, channels: 4, background: {r:0, g:0, b:0, alpha: 0.5}}}).png().toBuffer(),
         top: i * 20, left: i * 20
      }])
      .png()
      .toFile(`test_unrelated_${i+1}.png`);
  }
}

async function runTests() {
  await generateTestImages();

  const originalBuf = fs.readFileSync('public/logo.png');
  const hashOriginal = await computeAverageHash(originalBuf);

  const tests = [
    { name: 'Original', file: 'public/logo.png', expected: 'AUTHENTIC' },
    { name: 'Crop', file: 'test_1_crop.png', expected: 'LIKELY_TAMPERED' },
    { name: 'Resize', file: 'test_2_resize.png', expected: 'LIKELY_TAMPERED' },
    { name: 'Watermark', file: 'test_3_watermark.png', expected: 'LIKELY_TAMPERED' },
    { name: 'Brightness', file: 'test_4_brightness.png', expected: 'LIKELY_TAMPERED' },
    { name: 'Unrelated 1', file: 'test_unrelated_1.png', expected: 'NOT_FOUND' },
    { name: 'Unrelated 2', file: 'test_unrelated_2.png', expected: 'NOT_FOUND' },
    { name: 'Unrelated 3', file: 'test_unrelated_3.png', expected: 'NOT_FOUND' },
    { name: 'Unrelated 4', file: 'test_unrelated_4.png', expected: 'NOT_FOUND' },
    { name: 'Unrelated 5', file: 'test_unrelated_5.png', expected: 'NOT_FOUND' },
  ];

  console.log("Image Type | Hamming Distance | Classification | Status");
  console.log("---|---|---|---");

  for (const t of tests) {
    const buf = fs.readFileSync(t.file);
    const hash = await computeAverageHash(buf);
    const dist = computeHammingDistance(hashOriginal, hash);
    const classification = classifyDistance(dist);
    const status = classification === t.expected ? '✅ Pass' : '❌ Fail';
    
    console.log(`${t.name} | ${dist} | ${classification} | ${status}`);
  }
}

runTests().catch(console.error);
