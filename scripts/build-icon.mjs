#!/usr/bin/env node
// Build src/app/icon.png (and apple-icon.png): Instagram-esque
// orange → pink-red → purple gradient with the 30th / final level
// character (shakespearean-savant) centred on top. "Max-level" aspiration.
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
// Hero takes most of the icon but leaves a bit of gradient halo.
const HERO_SIZE = 460;
const HERO_OFFSET = Math.floor((SIZE - HERO_SIZE) / 2);

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

async function build() {
  if (!fs.existsSync(HERO_FILE)) {
    throw new Error(`hero image not found: ${HERO_FILE}`);
  }

  // Circular mask so the character reads as a medallion.
  const mask = Buffer.from(`
    <svg width="${HERO_SIZE}" height="${HERO_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${HERO_SIZE / 2}" cy="${HERO_SIZE / 2}" r="${HERO_SIZE / 2}" fill="white" />
    </svg>
  `);
  const hero = await sharp(HERO_FILE)
    .resize(HERO_SIZE, HERO_SIZE, { fit: "cover", position: "attention" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const base = await sharp(Buffer.from(gradientSvg())).png().toBuffer();
  const finalBuf = await sharp(base)
    .composite([{ input: hero, left: HERO_OFFSET, top: HERO_OFFSET }])
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
