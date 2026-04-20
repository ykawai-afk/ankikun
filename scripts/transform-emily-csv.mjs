import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

const IN = "/Users/yusukekawai/Desktop/mozu-matching-kun/emily_in_paris_vocab_public.csv";
const OUT = "/Users/yusukekawai/Desktop/mozu-matching-kun/emily_in_paris_vocab_ankikun.csv";

const raw = fs.readFileSync(IN, "utf8");
const parsed = Papa.parse(raw, {
  header: true,
  skipEmptyLines: "greedy",
  transformHeader: (h) => h.trim().toLowerCase(),
});

if (parsed.errors.length) {
  console.error("parse errors:", parsed.errors.slice(0, 3));
  process.exit(1);
}

const rows = parsed.data
  .map((r) => ({
    word: (r.word ?? "").trim(),
    reading: "",
    part_of_speech: (r.part_of_speech ?? "").trim(),
    definition_ja: (r.japanese_meaning ?? "").trim(),
    definition_en: "",
    example_en: (r.example_en ?? "").trim(),
    example_ja: (r.example_ja ?? "").trim(),
    etymology: "",
  }))
  .filter((r) => r.word && r.definition_ja);

console.log(`parsed ${parsed.data.length} rows, kept ${rows.length} with word+definition_ja`);

const out = Papa.unparse(rows, { header: true });
fs.writeFileSync(OUT, out, "utf8");
console.log(`wrote ${OUT}`);
