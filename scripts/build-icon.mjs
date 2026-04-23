#!/usr/bin/env node
// Build src/app/icon.png (and apple-icon.png):
// - Instagram-style orange → magenta → purple gradient as backdrop.
// - 30th / final character (Shakespearean Savant) composited on top with
//   its pastel background chroma-keyed out, so only the character itself
//   sits on the gradient.
//
// Usage: node scripts/build-icon.mjs

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const HERO_FILE = path.join(
  ROOT,
  "public",
  "levels",
  "shakespearean-savant.png"
);
const OUT_ICON = path.join(ROOT, "src", "app", "icon.png");
const OUT_APPLE = path.join(ROOT, "src", "app", "apple-icon.png");

const SIZE = 512;
const HERO_SIZE = 496; // nearly edge-to-edge, small gradient margin

function gradientSvg() {
  return `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stop-color="#fa8e1e" />
          <stop offset="35%" stop-color="#f53f6a" />
          <stop offset="65%" stop-color="#d22a84" />
          <stop offset="100%" stop-color="#7b2ea3" />
        </linearGradient>
      </defs>
      <rect width="${SIZE}" height="${SIZE}" fill="url(#g)" />
    </svg>
  `;
}

// Chroma-key the hero's pastel background out by sampling corner pixels
// (which sit outside the painted circle and carry the flat pastel backdrop
// Midjourney put behind the character), then fading alpha based on how
// close each pixel is to that sampled hue.
async function keyOutBackground(filePath, targetSize) {
  const prepped = await sharp(filePath)
    .resize(targetSize, targetSize, { fit: "cover", position: "attention" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = prepped;
  const { width, height, channels } = info;

  // Sample BOTH bg layers: the outer flat rect (corners) and the painted
  // pastel circle (a ring of 16 points just inside the expected circle
  // boundary). Median-style: drop outliers so a character's limb that
  // crosses a sample point doesn't poison the key colour.
  const sw = 18;
  const outerSamples = [];
  const pushPatch = (x0, y0, bucket) => {
    x0 = Math.max(0, Math.min(width - sw, x0));
    y0 = Math.max(0, Math.min(height - sw, y0));
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + sw; y++) {
      for (let x = x0; x < x0 + sw; x++) {
        const idx = (y * width + x) * channels;
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        n++;
      }
    }
    bucket.push({ r: r / n, g: g / n, b: b / n });
  };

  // Outer rectangle: 4 corners.
  pushPatch(0, 0, outerSamples);
  pushPatch(width - sw, 0, outerSamples);
  pushPatch(0, height - sw, outerSamples);
  pushPatch(width - sw, height - sw, outerSamples);

  // Inner circle: 16 points in a ring at radius ~0.43 of the canvas.
  const innerSamples = [];
  const cx = width / 2;
  const cy = height / 2;
  const ringR = Math.min(width, height) * 0.43;
  for (let i = 0; i < 16; i++) {
    const theta = (i / 16) * Math.PI * 2;
    const px = cx + Math.cos(theta) * ringR - sw / 2;
    const py = cy + Math.sin(theta) * ringR - sw / 2;
    pushPatch(Math.round(px), Math.round(py), innerSamples);
  }

  const bgOuter = medianColor(outerSamples);
  const bgInner = medianColor(innerSamples);

  const NEAR = 22;
  const FAR = 70;
  for (let i = 0; i < width * height; i++) {
    const idx = i * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const dOuter = colorDistance(r, g, b, bgOuter.r, bgOuter.g, bgOuter.b);
    const dInner = colorDistance(r, g, b, bgInner.r, bgInner.g, bgInner.b);
    const d = Math.min(dOuter, dInner);
    let alpha;
    if (d <= NEAR) alpha = 0;
    else if (d >= FAR) alpha = 255;
    else alpha = Math.round(((d - NEAR) / (FAR - NEAR)) * 255);
    data[idx + 3] = alpha;
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

function distance(
  a,
  b
) {
  return colorDistance(a.r, a.g, a.b, b.r, b.g, b.b);
}

function colorDistance(
  r1,
  g1,
  b1,
  r2,
  g2,
  b2
) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function averageColor(
  colors
) {
  const r = colors.reduce((s, c) => s + c.r, 0) / colors.length;
  const g = colors.reduce((s, c) => s + c.g, 0) / colors.length;
  const b = colors.reduce((s, c) => s + c.b, 0) / colors.length;
  return { r, g, b };
}

// Outlier-resistant average: discard the samples whose summed distance to
// the others is highest (they're probably sitting on the character, not bg).
function medianColor(samples) {
  if (samples.length <= 2) return averageColor(samples);
  const scored = samples
    .map((s) => ({
      s,
      score: samples.reduce((t, o) => t + distance(s, o), 0),
    }))
    .sort((a, b) => a.score - b.score);
  const keep = Math.max(1, Math.floor(scored.length * 0.6));
  return averageColor(scored.slice(0, keep).map((e) => e.s));
}

async function build() {
  if (!fs.existsSync(HERO_FILE)) {
    throw new Error(`hero image not found: ${HERO_FILE}`);
  }

  const hero = await keyOutBackground(HERO_FILE, HERO_SIZE);
  const base = await sharp(Buffer.from(gradientSvg())).png().toBuffer();
  const offset = Math.floor((SIZE - HERO_SIZE) / 2);

  const finalBuf = await sharp(base)
    .composite([{ input: hero, left: offset, top: offset }])
    .png()
    .toBuffer();

  fs.writeFileSync(OUT_ICON, finalBuf);
  console.log(`✓ ${path.relative(ROOT, OUT_ICON)} (${SIZE}×${SIZE})`);

  const appleBuf = await sharp(finalBuf).resize(180, 180).png().toBuffer();
  fs.writeFileSync(OUT_APPLE, appleBuf);
  console.log(`✓ ${path.relative(ROOT, OUT_APPLE)} (180×180)`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
