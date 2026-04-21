import fs from "node:fs";
import Papa from "papaparse";

const TOKEN = "ec73c86045a2bba80efc3093aab90f07d599e843c7fe9b2f43f4d68c44739c3f";
const URL = "https://ankikun.vercel.app/api/cards/bulk";
const CSV =
  "/Users/yusukekawai/Desktop/mozu-matching-kun/icarly_upto_bigfoot_vocab_public.csv";
const TAG = "iCarly";

const raw = fs.readFileSync(CSV, "utf8");
const parsed = Papa.parse(raw, {
  header: true,
  skipEmptyLines: "greedy",
  transformHeader: (h) => h.trim().toLowerCase(),
});

const cards = parsed.data
  .map((r) => ({
    word: (r.word ?? "").trim(),
    reading: null,
    part_of_speech: (r.part_of_speech ?? "").trim() || null,
    definition_ja: (r.japanese_meaning ?? "").trim(),
    definition_en: null,
    example_en: (r.example_en ?? "").trim() || null,
    example_ja: (r.example_ja ?? "").trim() || null,
    etymology: null,
    tags: [TAG],
  }))
  .filter((c) => c.word && c.definition_ja);

console.log(`posting ${cards.length} cards with tag "${TAG}"…`);

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
