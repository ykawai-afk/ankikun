// Bulk word-list enrichment via Claude Sonnet 4.6 → Ankikun.
//
// Reads a plain word list (one word per line), batches the words, asks
// Sonnet to fill in reading / part-of-speech / Japanese definition /
// English definition / EN+JA examples / etymology / CEFR / COCA frequency
// band per word, then posts to /api/cards/bulk.
//
// Designed for one-night-run of ~2-3k words. Guardrails:
//   * Hard cost ceiling (HARD_COST_LIMIT_USD).
//   * Concurrency cap so we don't trip Anthropic rate limits.
//   * Resume from .progress file (skip already-enriched words on rerun).
//   * Conflict on (user_id, lower(word)) → bulk endpoint rejects the
//     whole chunk, so we de-dupe against an existing-deck snapshot first.
//
// Usage:
//   ANKIKUN_BASE_URL=http://localhost:3001 \
//   ANKIKUN_TOKEN=$INGEST_TOKEN \
//   ANTHROPIC_API_KEY=sk-... \
//   node scripts/enrich-cards.mjs scripts/c1-word-list.txt
//
// Stops with non-zero exit if cost exceeds HARD_COST_LIMIT_USD.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// ---- Config ---------------------------------------------------------------

const BASE_URL = process.env.ANKIKUN_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.ANKIKUN_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const CARD_TYPE = process.env.CARD_TYPE === "expression" ? "expression" : "word";

const BATCH_SIZE = 25;       // words per Claude call
const CONCURRENCY = 4;        // parallel Claude calls in flight
const HARD_COST_LIMIT_USD = 30;
const BULK_CHUNK = 200;       // cards per /api/cards/bulk POST

// Sonnet 4.6 pricing (approx, USD per 1M tokens, prompt caching ignored).
const PRICE_INPUT_PER_M = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;

const INPUT_PATH = process.argv[2];
if (!INPUT_PATH) {
  console.error("usage: node scripts/enrich-cards.mjs <word-list.txt>");
  process.exit(1);
}
if (!TOKEN || !ANTHROPIC_KEY) {
  console.error("ANKIKUN_TOKEN and ANTHROPIC_API_KEY env vars required");
  process.exit(1);
}

const PROGRESS_PATH = `${INPUT_PATH}.progress`;
const LOG_PATH = `${INPUT_PATH}.log`;

// ---- Word list + resume ---------------------------------------------------

function readWordList(p) {
  const raw = fs.readFileSync(p, "utf8");
  const seen = new Set();
  const words = [];
  for (const line of raw.split(/\r?\n/)) {
    const w = line.trim();
    if (!w || w.startsWith("#")) continue;
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(w);
  }
  return words;
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) return new Set();
  const lines = fs.readFileSync(PROGRESS_PATH, "utf8").split(/\r?\n/);
  return new Set(lines.map((l) => l.trim().toLowerCase()).filter(Boolean));
}

function appendProgress(words) {
  fs.appendFileSync(
    PROGRESS_PATH,
    words.map((w) => w.toLowerCase()).join("\n") + "\n"
  );
}

function appendLog(line) {
  fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`);
}

// ---- Anthropic call -------------------------------------------------------

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const WORD_SYSTEM_PROMPT = `あなたは英語学習者向けの単語カード作成 AI です。
受け取った英単語のリストに対し、各単語について以下のフィールドを埋めた JSON 配列を返してください。

必ず以下の形式の JSON のみを返してください（前後の説明文は禁止）:
{
  "words": [
    {
      "word": "<元の単語、原型/小文字を保つ>",
      "reading": "<IPA 発音、不要なら null>",
      "part_of_speech": "<noun | verb | adjective | adverb | phrase など、不明なら null>",
      "definition_ja": "<日本語の自然な意味、1-2 行。学習者目線で>",
      "definition_en": "<英語の簡潔な定義、1 行>",
      "example_en": "<その単語を含む自然な英文 1 つ。学習者向けで難しすぎない>",
      "example_ja": "<example_en の自然な日本語訳>",
      "etymology": "<語源を 1 行で。例 \\"Latin articulare 'to join'\\"。不明なら null>",
      "difficulty": "<A1|A2|B1|B2|C1|C2>",
      "frequency_rank": <250|750|2000|4000|6500|10000|15000|28000|50000 のいずれかの整数。固有名詞や専門語で不明な場合のみ null>
    }
  ]
}

ルール:
- 各語につき必ず 1 つのエントリを返す（リスト順を保つ）。
- definition_ja は「研究社の辞書のような硬さ」ではなく「学習者にスッと入る説明」。
- example_en は短く自然に。固有名詞は避ける。
- difficulty は CEFR 基準。日本人の感覚で「鉄壁にあったかどうか」ではなく国際標準で判定。
- frequency_rank は COCA 9 band の midpoint（250/750/2000/4000/6500/10000/15000/28000/50000）から選ぶ。
- 返答は JSON のみ。前置きやコメント禁止。`;

const EXPRESSION_SYSTEM_PROMPT = `あなたは英語学習者向けのフレーズ/イディオム/句動詞カード作成 AI です。
受け取った英語フレーズのリストに対し、各フレーズについて以下のフィールドを埋めた JSON 配列を返してください。

必ず以下の形式の JSON のみを返してください（前後の説明文は禁止）:
{
  "words": [
    {
      "word": "<元のフレーズ、原型を保つ>",
      "reading": null,
      "part_of_speech": "<phrasal verb | collocation | idiom | discourse marker | hedging | business expression | formal phrase | informal phrase など、種別>",
      "definition_ja": "<日本語の自然な意味、1-2 行。学習者目線で。使う場面も簡単に>",
      "definition_en": "<英語の簡潔な定義、1 行>",
      "example_en": "<そのフレーズを含む自然な英文 1 つ。実務/会話で出るような自然さ>",
      "example_ja": "<example_en の自然な日本語訳>",
      "etymology": null,
      "difficulty": "<A1|A2|B1|B2|C1|C2>",
      "frequency_rank": <250|750|2000|4000|6500|10000|15000|28000|50000 のいずれかの整数。判定困難なら null>
    }
  ]
}

ルール:
- 各フレーズにつき必ず 1 つのエントリを返す（リスト順を保つ）。
- definition_ja は「直訳」じゃなく「ネイティブの感覚」で。「いつ使うか」も短く。
- example_en は実務 / 会話で本当に出るような自然な使い方を見せる。
- part_of_speech は「phrasal verb / collocation / idiom / discourse marker / hedging / business expression」あたりから一番近いものを 1 つ選ぶ。
- difficulty は CEFR 基準。
- 返答は JSON のみ。前置きやコメント禁止。`;

const SYSTEM_PROMPT =
  CARD_TYPE === "expression" ? EXPRESSION_SYSTEM_PROMPT : WORD_SYSTEM_PROMPT;

async function enrichBatch(words) {
  const payload = `次の英単語をカード化してください:\n${words
    .map((w, i) => `${i + 1}. ${w}`)
    .join("\n")}`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: payload }],
  });

  const text = res.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const usage = res.usage ?? { input_tokens: 0, output_tokens: 0 };
  const cost =
    (usage.input_tokens * PRICE_INPUT_PER_M) / 1_000_000 +
    (usage.output_tokens * PRICE_OUTPUT_PER_M) / 1_000_000;

  let parsed;
  try {
    // Strip code fences if Claude wrapped the JSON.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    appendLog(`parse-fail: ${text.slice(0, 200)} :: ${err.message}`);
    return { cards: [], cost };
  }

  if (!parsed?.words || !Array.isArray(parsed.words)) {
    appendLog(`shape-fail: ${JSON.stringify(parsed).slice(0, 200)}`);
    return { cards: [], cost };
  }

  // Coerce + minimal validation.
  const cards = parsed.words
    .map((w) => {
      if (typeof w?.word !== "string" || !w.word.trim()) return null;
      if (typeof w?.definition_ja !== "string" || !w.definition_ja.trim())
        return null;
      const card = {
        card_type: CARD_TYPE,
        word: w.word.trim(),
        reading: w.reading ?? null,
        part_of_speech: w.part_of_speech ?? null,
        definition_ja: w.definition_ja.trim(),
        definition_en: w.definition_en ?? null,
        example_en: w.example_en ?? null,
        example_ja: w.example_ja ?? null,
        etymology: w.etymology ?? null,
        difficulty: ["A1", "A2", "B1", "B2", "C1", "C2"].includes(w.difficulty)
          ? w.difficulty
          : null,
        frequency_rank:
          typeof w.frequency_rank === "number" &&
          [250, 750, 2000, 4000, 6500, 10000, 15000, 28000, 50000].includes(
            w.frequency_rank
          )
            ? w.frequency_rank
            : null,
        curriculum_source: "c1-curriculum-2026",
        tags: ["c1-curriculum", CARD_TYPE === "expression" ? "phrase" : "word"],
      };
      return card;
    })
    .filter(Boolean);

  return { cards, cost };
}

// ---- Bulk POST ------------------------------------------------------------

async function bulkPost(cards) {
  if (cards.length === 0) return { inserted: 0, skipped: 0 };
  const res = await fetch(`${BASE_URL}/api/cards/bulk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cards }),
  });
  const text = await res.text();
  if (!res.ok) {
    appendLog(`bulk-fail status=${res.status} body=${text.slice(0, 300)}`);
    return { inserted: 0, skipped: cards.length, error: text };
  }
  return JSON.parse(text);
}

// ---- Dedup against existing deck -----------------------------------------

async function fetchExistingWords() {
  const res = await fetch(`${BASE_URL}/api/cli/watch?limit=1000`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    appendLog(`watch-fetch status=${res.status}`);
    return new Set();
  }
  const body = await res.json();
  return new Set(
    (body.watch ?? []).map((c) => String(c.word).toLowerCase().trim())
  );
}

// ---- Pool runner ----------------------------------------------------------

async function runPool(items, worker, concurrency) {
  let i = 0;
  let inFlight = 0;
  let totalCost = 0;
  const results = [];
  return new Promise((resolve, reject) => {
    const tick = () => {
      while (inFlight < concurrency && i < items.length) {
        if (totalCost > HARD_COST_LIMIT_USD) {
          appendLog(`hard cost limit hit at $${totalCost.toFixed(2)}`);
          return resolve({ results, totalCost, aborted: true });
        }
        const idx = i++;
        const batch = items[idx];
        inFlight++;
        worker(batch)
          .then((r) => {
            inFlight--;
            results.push(r);
            totalCost += r.cost ?? 0;
            console.log(
              `[${results.length}/${items.length}] batch +${r.cards?.length ?? 0} cards, $${(r.cost ?? 0).toFixed(4)} (total $${totalCost.toFixed(2)})`
            );
            tick();
          })
          .catch((err) => {
            inFlight--;
            appendLog(`worker-error ${err.message}`);
            console.error(`batch ${idx} failed: ${err.message}`);
            results.push({ cards: [], cost: 0, error: err.message });
            tick();
          });
      }
      if (inFlight === 0 && i >= items.length) {
        resolve({ results, totalCost, aborted: false });
      }
    };
    tick();
  });
}

// ---- Main -----------------------------------------------------------------

async function main() {
  const allWords = readWordList(INPUT_PATH);
  const progress = loadProgress();
  const existing = await fetchExistingWords();
  console.log(
    `loaded word list: ${allWords.length} unique words; progress: ${progress.size} done; deck: ${existing.size} existing`
  );

  const remaining = allWords.filter(
    (w) =>
      !progress.has(w.toLowerCase()) && !existing.has(w.toLowerCase().trim())
  );
  console.log(`enriching ${remaining.length} words…`);
  appendLog(
    `start: list=${allWords.length} progress=${progress.size} existing=${existing.size} remaining=${remaining.length}`
  );

  // Bucket into batches.
  const batches = [];
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    batches.push(remaining.slice(i, i + BATCH_SIZE));
  }
  console.log(`${batches.length} batches × ${BATCH_SIZE} words`);

  const { results, totalCost, aborted } = await runPool(
    batches,
    async (batch) => {
      const { cards, cost } = await enrichBatch(batch);
      // Push to Ankikun in BULK_CHUNK chunks.
      let pushed = 0;
      for (let i = 0; i < cards.length; i += BULK_CHUNK) {
        const slice = cards.slice(i, i + BULK_CHUNK);
        const r = await bulkPost(slice);
        pushed += r.inserted ?? 0;
      }
      // Record successful batch words to progress regardless of dedup;
      // we don't want to retry them next run.
      appendProgress(batch);
      return { cards, cost, pushed };
    },
    CONCURRENCY
  );

  const totalCards = results.reduce((s, r) => s + (r.cards?.length ?? 0), 0);
  console.log(`
=== done ===`);
  console.log(`batches:    ${results.length}`);
  console.log(`cards:      ${totalCards}`);
  console.log(`cost:       $${totalCost.toFixed(2)} (limit $${HARD_COST_LIMIT_USD})`);
  console.log(`aborted:    ${aborted}`);
  console.log(`log:        ${LOG_PATH}`);
  console.log(`progress:   ${PROGRESS_PATH}`);
  appendLog(
    `done batches=${results.length} cards=${totalCards} cost=$${totalCost.toFixed(2)} aborted=${aborted}`
  );

  process.exit(aborted ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  appendLog(`fatal ${err?.message ?? err}`);
  process.exit(1);
});
