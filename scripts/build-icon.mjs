#!/usr/bin/env node
// Build src/app/icon.png (and apple-icon.png): Instagram-esque
// orange → pink-red → purple gradient backdrop with the 30 level avatars
// floating over it as rounded tiles, the gradient peeking through the gaps.
//
// Usage: node scripts/build-icon.mjs

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const LEVELS_DIR = path.join(ROOT, "public", "levels");
const OUT_ICON = path.join(ROOT, "src", "app", "icon.png");
const OUT_APPLE = path.join(ROOT, "src", "app", "apple-icon.png");

const SIZE = 512;
const COLS = 5;
const ROWS = 6;
const PADDING = 12;       // outer margin
const GAP = 6;            // space between tiles (gradient shows through)
const TILE_RADIUS = 16;

function gradientSvg() {
  // Instagram-flavoured warm-to-cool: orange → magenta → purple.
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

async function roundedTile(filePath, size, radius) {
  const mask = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white" />
    </svg>
  `);
  return sharp(filePath)
    .resize(size, size, { fit: "cover", position: "attention" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function build() {
  const files = fs
    .readdirSync(LEVELS_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .slice(0, COLS * ROWS);
  if (files.length === 0) {
    throw new Error(`no level images in ${LEVELS_DIR}`);
  }

  const usableW = SIZE - PADDING * 2 - GAP * (COLS - 1);
  const usableH = SIZE - PADDING * 2 - GAP * (ROWS - 1);
  const tileW = Math.floor(usableW / COLS);
  const tileH = Math.floor(usableH / ROWS);
  const tileSize = Math.min(tileW, tileH);

  const tiles = await Promise.all(
    files.map(async (f, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const left = PADDING + col * (tileSize + GAP);
      const top = PADDING + row * (tileSize + GAP);
      const buf = await roundedTile(
        path.join(LEVELS_DIR, f),
        tileSize,
        TILE_RADIUS
      );
      return { input: buf, left, top };
    })
  );

  const base = await sharp(Buffer.from(gradientSvg()))
    .png()
    .toBuffer();

  const finalBuf = await sharp(base).composite(tiles).png().toBuffer();

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
