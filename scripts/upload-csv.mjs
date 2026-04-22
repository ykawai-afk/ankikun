import fs from "node:fs";
import Papa from "papaparse";

const TOKEN = "ec73c86045a2bba80efc3093aab90f07d599e843c7fe9b2f43f4d68c44739c3f";
const URL = "https://ankikun.vercel.app/api/cards/bulk";
const CSV =
  "/Users/yusukekawai/Desktop/mozu-matching-kun/emily_in_paris_vocab_public.csv";
const TAG = "Emily in Paris";

const raw = fs.readFileSync(CSV, "utf8");
const parsed = Papa.parse(raw, {
  header: true,
  skipEmptyLines: "greedy",
  transformHeader: (h) => h.trim().toLowerCase(),
});

if (parsed.errors.length) {
  console.error("parse errors:", parsed.errors.slice(0, 3));
  process.exit(1);
}

const cards = parsed.data
  .map((r) => ({
    word: r.word ?? r.word,
    reading: r.reading ?? null,
    part_of_speech: r.part_of_speech ?? null,
    definition_ja: r.definition_ja ?? r.japanese_meaning ?? null,
    definition_en: r.definition_en ?? null,
    example_en: r.example_en ?? null,
    example_ja: r.example_ja ?? null,
    etymology: r.etymology ?? null,
    tags: [TAG],
  }))
  .filter((c) => c.word && c.definition_ja);

console.log(`posting ${cards.length} cards…`);

const res = await fetch(URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ cards }),
});

const text = await res.text();
console.log("status:", res.status);
console.log("body:", text);
process.exit(res.ok ? 0 : 1);
