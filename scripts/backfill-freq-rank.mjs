#!/usr/bin/env node
// Classify existing cards.frequency_rank via chat-based labelling (Claude
// Code in the loop, not an API call).  Two subcommands:
//
//   export [--batch N] [--size 150]
//     Dumps the N-th batch of cards that still have frequency_rank=NULL into
//     ./scripts/freq-batches/batch-N.json (read-only view — id, word,
//     definition_ja, part_of_speech, difficulty, example_en).  Claude fills
//     a `frequency_rank` field on each entry and saves the file back.
//
//   apply <batch-file>
//     Reads a patched JSON file and applies UPDATE statements for every
//     entry that has a non-null `frequency_rank` (valid bands only).
//
// Usage: node scripts/backfill-freq-rank.mjs export --batch 1
//        node scripts/backfill-freq-rank.mjs apply scripts/freq-batches/batch-1.json

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local ourselves — this script runs outside Next's env loader.
const envPath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VALID_BANDS = new Set([250, 750, 2000, 4000, 6500, 10000, 15000, 28000, 50000]);
const BATCH_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "freq-batches"
);

function parseArgs(argv) {
  const out = { batch: 1, size: 150 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--batch") out.batch = Number(argv[++i]);
    else if (argv[i] === "--size") out.size = Number(argv[++i]);
  }
  return out;
}

async function cmdExport(argv) {
  const { batch, size } = parseArgs(argv);
  if (!Number.isFinite(batch) || batch < 1) throw new Error("--batch must be a positive integer");
  if (!Number.isFinite(size) || size < 1) throw new Error("--size must be a positive integer");
  fs.mkdirSync(BATCH_DIR, { recursive: true });

  // Always pull the next `size` rows that still lack a rank; batch number
  // is only a filename convenience. Using absolute offsets was wrong: as
  // each batch applies, the null-rank set shrinks, so batch N's slice
  // would walk off the end.
  const { data, error } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja, difficulty, example_en, created_at")
    .is("frequency_rank", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(size);
  if (error) throw error;
  if (!data || data.length === 0) {
    console.log(`No more unranked cards — batch ${batch} is empty.`);
    return;
  }

  const outPath = path.join(BATCH_DIR, `batch-${batch}.json`);
  const body = data.map((c) => ({
    id: c.id,
    word: c.word,
    part_of_speech: c.part_of_speech,
    definition_ja: c.definition_ja,
    difficulty: c.difficulty,
    example_en: c.example_en,
    frequency_rank: null, // ← Claude fills this in
  }));
  fs.writeFileSync(outPath, JSON.stringify(body, null, 2));
  console.log(`✓ wrote ${body.length} cards to ${path.relative(process.cwd(), outPath)}`);
}

async function cmdApply(argv) {
  const file = argv[0];
  if (!file) throw new Error("usage: apply <path/to/batch-N.json>");
  const body = JSON.parse(fs.readFileSync(file, "utf8"));
  const updates = [];
  const skipped = [];
  for (const row of body) {
    if (row.frequency_rank === null || row.frequency_rank === undefined) {
      skipped.push({ id: row.id, word: row.word, reason: "null" });
      continue;
    }
    if (!VALID_BANDS.has(row.frequency_rank)) {
      skipped.push({ id: row.id, word: row.word, reason: `invalid band ${row.frequency_rank}` });
      continue;
    }
    updates.push({ id: row.id, rank: row.frequency_rank });
  }

  let applied = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from("cards")
      .update({ frequency_rank: u.rank })
      .eq("id", u.id);
    if (error) {
      console.error(`✗ ${u.id}: ${error.message}`);
      continue;
    }
    applied++;
  }
  console.log(`✓ applied ${applied}/${updates.length} updates`);
  if (skipped.length > 0) {
    console.log(`⚠ skipped ${skipped.length}:`);
    for (const s of skipped) console.log(`  - ${s.word} (${s.id}): ${s.reason}`);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "export") return cmdExport(rest);
  if (cmd === "apply") return cmdApply(rest);
  console.error("usage:\n  node scripts/backfill-freq-rank.mjs export [--batch N] [--size 150]\n  node scripts/backfill-freq-rank.mjs apply <batch-file>");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
