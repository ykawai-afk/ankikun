#!/usr/bin/env node
// Pull newly-generated level avatars from ~/Desktop/animation/ into
// public/levels/. Use after each Midjourney upscale export.
//
// Expected source filenames (same as the 30 targets in public/levels/):
//   nerdy-fifth-grader.png, rebel-eighth-grader.png, ...
// Midjourney downloads often have a prefix + UUID — this script also
// accepts any .png whose name STARTS WITH the target stem, so e.g.
//   "nerdy-fifth-grader_u1_3f8a.png" → nerdy-fifth-grader.png works.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SRC = path.join(os.homedir(), "Desktop", "animation");
const DST = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "public",
  "levels"
);

const TARGETS = [
  "babbling-baby.png",
  "toddler-chatterbox.png",
  "preschool-questioner.png",
  "first-grade-storyteller.png",
  "second-grade-bookworm.png",
  "third-grade-daydreamer.png",
  "spelling-bee-rookie.png",
  "nerdy-fifth-grader.png",
  "sixth-grade-know-it-all.png",
  "middle-school-debater.png",
  "rebel-eighth-grader.png",
  "freshman-overachiever.png",
  "ap-lit-sophomore.png",
  "junior-editor.png",
  "varsity-valedictorian.png",
  "national-merit-finalist.png",
  "liberal-arts-freshman.png",
  "english-major.png",
  "creative-writing-workshopper.png",
  "coffee-fueled-grad.png",
  "graduate-ta.png",
  "phd-candidate.png",
  "dissertation-survivor.png",
  "postdoc-scholar.png",
  "tenured-professor.png",
  "corner-office-pro.png",
  "newsroom-editor.png",
  "published-novelist.png",
  "lexicographer.png",
  "shakespearean-savant.png",
];

function matchSource(targetStem, files) {
  // Exact match wins
  const exact = files.find((f) => f === `${targetStem}.png`);
  if (exact) return exact;
  // Otherwise prefix match (first hit)
  const prefix = files.find(
    (f) =>
      f.toLowerCase().startsWith(targetStem.toLowerCase()) &&
      f.toLowerCase().endsWith(".png")
  );
  return prefix ?? null;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`source not found: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(DST, { recursive: true });

  const files = fs.readdirSync(SRC);
  let copied = 0;
  let skipped = 0;
  const missing = [];

  for (const target of TARGETS) {
    const stem = target.replace(/\.png$/, "");
    const match = matchSource(stem, files);
    if (!match) {
      missing.push(target);
      continue;
    }
    const from = path.join(SRC, match);
    const to = path.join(DST, target);

    const dstExists = fs.existsSync(to);
    if (dstExists) {
      const srcStat = fs.statSync(from);
      const dstStat = fs.statSync(to);
      if (srcStat.mtimeMs <= dstStat.mtimeMs) {
        skipped++;
        continue;
      }
    }
    fs.copyFileSync(from, to);
    copied++;
    const action = dstExists ? "updated" : "added";
    console.log(`\x1b[32m${action}\x1b[0m  ${match}  →  public/levels/${target}`);
  }

  console.log();
  console.log(
    `copied=${copied}  skipped=${skipped}  still-missing=${missing.length}`
  );
  if (missing.length > 0 && missing.length <= 10) {
    console.log("missing files:");
    for (const m of missing) console.log(`  ${m}`);
  } else if (missing.length > 0) {
    console.log(`missing: ${missing.length} files (run with --verbose to list)`);
    if (process.argv.includes("--verbose")) {
      for (const m of missing) console.log(`  ${m}`);
    }
  }
}

main();
