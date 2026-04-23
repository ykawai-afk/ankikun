#!/usr/bin/env node
// Build src/app/icon.png (and apple-icon.png) from the 30 level avatars
// tiled behind a tinted "A" overlay. Run after swapping level images.
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
const COLS = 5; // 5 × 6 = 30 tiles
const ROWS = 6;
const TILE = Math.ceil(SIZE / COLS); // 103px

async function buildComposite() {
  const files = fs
    .readdirSync(LEVELS_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();
  if (files.length === 0) {
    throw new Error(`no level images in ${LEVELS_DIR}`);
  }

  // Resize each tile to TILE×TILE and place into a grid.
  const tiles = await Promise.all(
    files.slice(0, COLS * ROWS).map(async (f, i) => {
      const buf = await sharp(path.join(LEVELS_DIR, f))
        .resize(TILE, TILE, { fit: "cover", position: "attention" })
        .toBuffer();
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        input: buf,
        left: col * TILE,
        top: row * TILE,
      };
    })
  );

  // Background canvas sized up to TILE*COLS × TILE*ROWS, then cropped to
  // 512×512 from top.
  const grid = await sharp({
    create: {
      width: TILE * COLS,
      height: TILE * ROWS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(tiles)
    .png()
    .toBuffer();

  // Crop/pad to SIZE×SIZE (center-crop vertically).
  const gridSized = await sharp(grid)
    .resize(SIZE, SIZE, { fit: "cover", position: "center" })
    .png()
    .toBuffer();

  // Tinted accent gradient overlay + the letter "A".
  const overlaySvg = Buffer.from(`
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.78" />
          <stop offset="60%" stop-color="#7c3aed" stop-opacity="0.72" />
          <stop offset="100%" stop-color="#f97316" stop-opacity="0.68" />
        </linearGradient>
        <radialGradient id="v" cx="50%" cy="55%" r="70%">
          <stop offset="40%" stop-color="#000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000" stop-opacity="0.35" />
        </radialGradient>
        <filter id="s" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.45" />
        </filter>
      </defs>
      <rect width="${SIZE}" height="${SIZE}" fill="url(#g)" />
      <rect width="${SIZE}" height="${SIZE}" fill="url(#v)" />
      <text
        x="50%" y="50%"
        text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="800"
        font-size="320"
        fill="white"
        filter="url(#s)"
        letter-spacing="-0.05em"
      >A</text>
    </svg>
  `);

  const finalBuf = await sharp(gridSized)
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return finalBuf;
}

async function main() {
  const buf = await buildComposite();
  fs.writeFileSync(OUT_ICON, buf);
  console.log(`✓ ${path.relative(ROOT, OUT_ICON)} (${SIZE}×${SIZE})`);

  // Apple touch icon: 180×180
  const appleBuf = await sharp(buf).resize(180, 180).png().toBuffer();
  fs.writeFileSync(OUT_APPLE, appleBuf);
  console.log(`✓ ${path.relative(ROOT, OUT_APPLE)} (180×180)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
