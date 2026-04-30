// generate-icons.mjs
// Run with: node generate-icons.mjs
// Uses the `sharp` package already installed in the project.

import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = join(__dirname, "public", "icons", "icon-source.svg");
const outDir = join(__dirname, "public", "icons");

mkdirSync(outDir, { recursive: true });

const svgBuffer = readFileSync(svgPath);

for (const size of sizes) {
  const outPath = join(outDir, `icon-${size}x${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✅  Generated ${size}x${size} → ${outPath}`);
}

// Also generate apple-touch-icon (180x180)
const appleOut = join(__dirname, "public", "apple-touch-icon.png");
await sharp(svgBuffer).resize(180, 180).png().toFile(appleOut);
console.log(`✅  Generated apple-touch-icon (180x180) → ${appleOut}`);

// favicon-32x32 and favicon-16x16
for (const size of [16, 32]) {
  const favOut = join(__dirname, "public", `favicon-${size}x${size}.png`);
  await sharp(svgBuffer).resize(size, size).png().toFile(favOut);
  console.log(`✅  Generated favicon-${size}x${size} → ${favOut}`);
}

console.log("\n🎉  All icons generated successfully!");
