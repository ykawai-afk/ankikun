import crypto from "node:crypto";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as cheerio from "cheerio";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDeepDive } from "@/lib/deep-dive";

export const ALLOWED_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

const RelatedWordSchema = z.object({
  word: z.string(),
  part_of_speech: z.string().nullable(),
  meaning_ja: z.string(),
});

const ExtraExampleSchema = z.object({
  en: z.string(),
  ja: z.string(),
  register: z.enum(["formal", "conversational", "idiom"]).nullable(),
});

const CEFRSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).nullable();

// Canonical 9-band frequency ladder. Claude must pick one of these exact
// midpoint values or null (for proper nouns / acronyms / technical jargon).
// The numeric integers are what gets stored in cards.frequency_rank.
export const FREQ_BAND_MIDPOINTS = [
  250, 750, 2000, 4000, 6500, 10000, 15000, 28000, 50000,
] as const;
export type FreqBandMidpoint = (typeof FREQ_BAND_MIDPOINTS)[number];

const FrequencyRankSchema = z
  .union([
    z.literal(250),
    z.literal(750),
    z.literal(2000),
    z.literal(4000),
    z.literal(6500),
    z.literal(10000),
    z.literal(15000),
    z.literal(28000),
    z.literal(50000),
  ])
  .nullable();

const WordSchema = z.object({
  word: z.string(),
  reading: z.string().nullable(),
  part_of_speech: z.string().nullable(),
  definition_ja: z.string(),
  definition_en: z.string().nullable(),
  example_en: z.string().nullable(),
  example_ja: z.string().nullable(),
  etymology: z.string().nullable(),
  difficulty: CEFRSchema,
  frequency_rank: FrequencyRankSchema,
  related_words: z.array(RelatedWordSchema),
  extra_examples: z.array(ExtraExampleSchema),
});

const ExtractionSchema = z.object({
  source_context: z.string().nullable(),
  words: z.array(WordSchema),
});

const SingleWordSchema = z.object({
  word: WordSchema,
});

const SINGLE_WORD_PROMPT = `あなたは日本人英語学習者向け単語カード作成アシスタント。
ユーザーがWeb上で明示的に選択した1語(または短いフレーズ)について、カードを1枚だけ作成します。

ルール:
- 選択された語を lemma(原形) に戻して word に格納 (例: "mitigating" → "mitigate", "tools" → "tool")
- 選択が複数語フレーズの場合はそのまま保持 (例: "cut corners")
- 固有名詞(人名・地名・ブランド等)なら word に "__SKIP__" とだけ返して他は空でOK (呼び出し側が無視する)
- その他のフィールドは通常のカードと同じ書式。例文は「日常で実際にあり得るシーン」限定。

各フィールドの指針:
- word: 必ず lemma
- reading: IPA (例: "/rʌn/")。不明なら null
- part_of_speech: "noun"/"verb"/"adjective"/"adverb"/"phrase"
- definition_ja: 日本語で簡潔に
- definition_en: 英英定義(短く)
- example_en: その単語を使った日常シーンの自然な例文1つ。文学調/哲学調/論文調は禁止
- example_ja: example_enの自然な日本語訳
- etymology: 語源 (不明なら null)
- difficulty: CEFRレベル判定。"A1"(500語)/"A2"(1000語)/"B1"(2500語)/"B2"(4000語)/"C1"(8000語)/"C2"(15000+語)。基本〜中学語彙はA1-A2、高校〜TOEIC700はB1-B2、英検1級〜TOEIC900はC1、学術・希少語はC2。不確実ならnull
- frequency_rank: COCA英語頻度ランクの概算。以下の9バンドから**必ずいずれかの整数値**を選ぶ。固有名詞・頭字語・技術固有語のみ null:
  250   → 1–500位  (最頻出)      "the, and, go, make, say"
  750   → 501–1500位              "however, decide, mention, likely"
  2000  → 1501–3000位             "assume, consequence, rely, significant"
  4000  → 3001–5000位             "undermine, diligent, consolidate, implicit"
  6500  → 5001–8000位             "mitigate, stipulate, articulate, elusive"
  10000 → 8001–12000位            "elucidate, cogent, proliferate, ostensible"
  15000 → 12001–20000位           "obfuscate, nebulous, sanguine, recalcitrant"
  28000 → 20001–40000位           "sesquipedalian, ineffable, quixotic"
  50000 → 40001+位 (古語・高度学術) "antediluvian, obstreperous, defenestrate"
  CEFRと整合するはず (A1/A2→250-750, B1→2000, B2→4000-6500, C1→6500-10000, C2→15000+)。フレーズは主要語で判定
- related_words: word family を2-4個
- extra_examples: 文脈別に2-3個。register を多様化 (formal=会社員メール, conversational=カジュアル, idiom=実用的慣用句)`;

const SYSTEM_PROMPT = `あなたは日本人英語学習者向け単語カード作成アシスタント。
スクリーンショットから「学習価値の高い英単語」を抽出し、カード化します。

抽出ルール:
- 中級以上(高校〜TOEIC800+相当)を優先。基本語(the, is, this, have など)は除外
- 固有名詞(人名・商品名・地名等)は除外
- 1画像から最大8語まで
- 同義語が並んでいる場合は代表1語を選ぶ

各単語のフィールド:
- word: 原形(lemma)。動詞は不定形、名詞は単数
- reading: IPA発音記号 (例: "/rʌn/")。不明ならnull
- part_of_speech: "noun"/"verb"/"adjective"/"adverb"/"phrase" 等
- definition_ja: 日本語での主要な意味を簡潔に
- definition_en: 英英定義(短く)
- example_en: その単語を使った**日常で実際にあり得る例文1つ**。会話・職場メール・友人とのやりとり・旅行・ショッピング・ニュース・家事・趣味など実生活の具体シーン。文学調/哲学的/論文調/抽象的な不自然例文は禁止。短く具体的に。
  ✅良い例(mitigate): "I took ginger to mitigate the motion sickness on the bus."
  ❌悪い例(mitigate): "Philosophers have long sought to mitigate the existential dread of mortality."
- example_ja: example_enの自然な日本語訳
- etymology: 語源（Latin/Greek/Old English/Old French等の起源、意味のある接頭辞・語根・接尾辞、関連語を1-2文で。例: "Latin 'elusus' (past participle of 'eludere': e-「外へ」+ ludere「遊ぶ」)。to avoid/escapeのイメージ"）。不明なら null
- difficulty: CEFRレベル判定。A1(500語圏)/A2(1000語)/B1(2500語)/B2(4000語)/C1(8000語)/C2(15000+語)。中学基礎=A1-A2、高校〜TOEIC700=B1-B2、英検1級〜TOEIC900=C1、学術・希少語=C2。不確実ならnull
- frequency_rank: COCA英語頻度ランクの概算。以下の9バンドから**必ずいずれかの整数値**を選ぶ。固有名詞・頭字語・技術固有語のみ null:
  250=1–500位 "the/go/make", 750=501–1500位 "however/decide", 2000=1501–3000位 "assume/rely",
  4000=3001–5000位 "undermine/diligent", 6500=5001–8000位 "mitigate/elusive",
  10000=8001–12000位 "cogent/proliferate", 15000=12001–20000位 "nebulous/sanguine",
  28000=20001–40000位 "quixotic/ineffable", 50000=40001+位 "antediluvian/obstreperous"
  CEFRと整合 (A1/A2→250-750, B1→2000, B2→4000-6500, C1→6500-10000, C2→15000+)
- related_words: word family (同語根の派生語) を2-4個。例: elusive → [{word:"elude", part_of_speech:"verb", meaning_ja:"巧みに避ける"}, ...]。なければ空配列[]
- extra_examples: 例文を文脈別に2-3個追加。**日常で実際にあり得るシーン**(職場メール・Slack・友人との会話・家族・旅行・ショッピング・ニュース等) から register を多様化:
  - "formal" = 職場メール/会議/ビジネス文書 (法律文書や学術論文ではなく、普通の会社員が書くレベル)
  - "conversational" = 友人/家族/同僚とのカジュアルな会話
  - "idiom" = 実際の会話で使われる慣用表現
  判定不能ならnull。なければ空配列[]。文学調/哲学調/抽象的な不自然例文は禁止。
- source_context: スクショの文脈(1文、なくてよければnull)`;

// Haiku-based rescue for frequency_rank. Called only for words whose primary
// pass returned rank=null despite having a CEFR — i.e. the primary model
// forgot the field rather than legitimately marking it as a proper noun.
// Haiku can't skip: we force it to pick a band. Absolute-last-resort nulls
// (schema violation or upstream error) propagate; the nightly backfill
// script will mop them up.
const FreqRescueSchema = z.object({ frequency_rank: FrequencyRankSchema });
const FREQ_RESCUE_SYSTEM = `あなたは英単語のCOCA頻度ランク推定器。
以下の9バンドのうち最も近い整数を1つだけ返す。固有名詞・頭字語・技術固有語のみnull:
250=1–500位 "the/go", 750=501–1500位 "however/decide", 2000=1501–3000位 "assume/rely",
4000=3001–5000位 "undermine/diligent", 6500=5001–8000位 "mitigate/elusive",
10000=8001–12000位 "cogent", 15000=12001–20000位 "nebulous", 28000=20001–40000位 "quixotic",
50000=40001+位 "antediluvian"`;

async function rescueFrequencyRank(
  word: string,
  cefrHint: string | null
): Promise<FreqBandMidpoint | null> {
  try {
    const anthropic = getAnthropicClient();
    const result = await anthropic.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: FREQ_RESCUE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `語: "${word}"${cefrHint ? ` (CEFR: ${cefrHint})` : ""}`,
        },
      ],
      output_config: { format: zodOutputFormat(FreqRescueSchema) },
    });
    return result.parsed_output?.frequency_rank ?? null;
  } catch {
    return null;
  }
}

// Drop inserts whose `word` (case-insensitive) is already in the user's
// deck or duplicates another word in this same ingestion batch. The
// ingest prompt already normalises to lemma form, so equality on the
// lowercased word is sufficient. Returns the filtered inserts and the
// list of words that were skipped (so the caller can surface a count).
async function dedupeInsertsAgainstDeck<T extends { word: string }>(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  inserts: T[]
): Promise<{ deduped: T[]; skipped: string[] }> {
  if (inserts.length === 0) return { deduped: [], skipped: [] };
  const norm = (w: string) => w.toLowerCase().trim();

  const seen = new Set<string>();
  const internal: T[] = [];
  const skipped: string[] = [];
  for (const c of inserts) {
    const k = norm(c.word);
    if (!k) continue;
    if (seen.has(k)) {
      skipped.push(c.word);
      continue;
    }
    seen.add(k);
    internal.push(c);
  }

  const { data: existingRows } = await supabase
    .from("cards")
    .select("word")
    .eq("user_id", userId);
  const existing = new Set(
    (existingRows ?? []).map((r) => norm(r.word as string))
  );

  const deduped: T[] = [];
  for (const c of internal) {
    if (existing.has(norm(c.word))) {
      skipped.push(c.word);
      continue;
    }
    deduped.push(c);
  }
  return { deduped, skipped };
}

// Generate and attach deep_dive for every freshly-inserted card in
// parallel. Called right after the cards insert so new cards arrive with
// root/cognate info ready for the root-review mode. Failures per card
// are swallowed — deep_dive stays null for that card and the backfill
// script picks it up later.
async function attachDeepDivesToNewCards(
  supabase: ReturnType<typeof createAdminClient>,
  inserted: {
    id: string;
    word: string;
    part_of_speech: string | null;
    definition_ja: string;
    etymology: string | null;
  }[]
): Promise<void> {
  if (inserted.length === 0) return;
  await Promise.allSettled(
    inserted.map(async (c) => {
      const dd = await generateDeepDive(c);
      if (!dd) return;
      await supabase.from("cards").update({ deep_dive: dd }).eq("id", c.id);
    })
  );
}

// Mutates the inserts array in place: replaces any frequency_rank=null on
// words that have a CEFR (i.e. the primary model forgot the field) with a
// Haiku-rescued band midpoint. Words with difficulty=null are assumed to be
// legitimate nulls (proper nouns, acronyms) and skipped.
async function rescueMissingFreqRanks<
  T extends { word: string; difficulty: string | null; frequency_rank: number | null }
>(inserts: T[]): Promise<void> {
  const targets = inserts.filter(
    (c) => c.difficulty !== null && c.frequency_rank === null
  );
  if (targets.length === 0) return;
  const rescued = await Promise.all(
    targets.map((c) => rescueFrequencyRank(c.word, c.difficulty))
  );
  targets.forEach((c, i) => {
    c.frequency_rank = rescued[i];
  });
}

export function pickMediaType(input: string): AllowedMediaType {
  const normalized = input.toLowerCase();
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(normalized)
    ? (normalized as AllowedMediaType)
    : "image/png";
}

function extForMediaType(mt: AllowedMediaType): string {
  return (
    { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" } as const
  )[mt];
}

export type IngestResult = {
  ingestion_id: string;
  cards_created: number;
  words: string[];
  skipped_duplicates: string[];
};

export async function processIngest({
  bytes,
  mediaType,
  userId,
}: {
  bytes: Buffer;
  mediaType: AllowedMediaType;
  userId: string;
}): Promise<IngestResult> {
  const supabase = createAdminClient();
  const imagePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extForMediaType(mediaType)}`;

  const { error: uploadError } = await supabase.storage
    .from("screenshots")
    .upload(imagePath, bytes, { contentType: mediaType, upsert: false });
  if (uploadError) throw new Error(`storage upload failed: ${uploadError.message}`);

  const { data: ingestion, error: ingError } = await supabase
    .from("ingestions")
    .insert({ user_id: userId, image_path: imagePath, status: "pending" })
    .select()
    .single();
  if (ingError || !ingestion) {
    throw new Error(`ingestion record failed: ${ingError?.message}`);
  }

  try {
    const anthropic = getAnthropicClient();
    const base64 = bytes.toString("base64");

    const result = await anthropic.messages.parse({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "このスクリーンショットから学習価値の高い英単語を抽出してカードを作成してください。",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ExtractionSchema) },
    });

    const parsed = result.parsed_output;
    if (!parsed) throw new Error(`structured output missing (stop_reason: ${result.stop_reason})`);

    const cardsToInsert = parsed.words.map((w) => ({
      user_id: userId,
      word: w.word,
      reading: w.reading,
      part_of_speech: w.part_of_speech,
      definition_ja: w.definition_ja,
      definition_en: w.definition_en,
      example_en: w.example_en,
      example_ja: w.example_ja,
      etymology: w.etymology,
      difficulty: w.difficulty,
      frequency_rank: w.frequency_rank,
      related_words: w.related_words.length > 0 ? w.related_words : null,
      extra_examples: w.extra_examples.length > 0 ? w.extra_examples : null,
      source_image_path: imagePath,
      source_context: parsed.source_context,
    }));

    const { deduped, skipped } = await dedupeInsertsAgainstDeck(
      supabase,
      userId,
      cardsToInsert
    );
    if (deduped.length > 0) {
      await rescueMissingFreqRanks(deduped);
      const { data: inserted, error: cardsError } = await supabase
        .from("cards")
        .insert(deduped)
        .select("id, word, part_of_speech, definition_ja, etymology");
      if (cardsError) throw new Error(`cards insert failed: ${cardsError.message}`);
      await attachDeepDivesToNewCards(supabase, inserted ?? []);
    }

    await supabase
      .from("ingestions")
      .update({
        status: "processed",
        raw_response: parsed as unknown as Record<string, unknown>,
        cards_created: deduped.length,
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);

    return {
      ingestion_id: ingestion.id,
      cards_created: deduped.length,
      words: deduped.map((c) => c.word),
      skipped_duplicates: skipped,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("ingestions")
      .update({
        status: "failed",
        error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);
    throw err;
  }
}

async function fetchArticleText(url: string): Promise<{
  text: string;
  title: string | null;
}> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Ankikun/1.0; +https://ankikun.vercel.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, aside, noscript, iframe").remove();
  const title = $("title").text().trim() || null;
  const article =
    $("article").first().text() ||
    $("main").first().text() ||
    $("[role=main]").first().text() ||
    $("body").text();
  const clean = article.replace(/\s+/g, " ").trim().slice(0, 18000);
  if (clean.length < 200) {
    throw new Error(`article too short (${clean.length} chars)`);
  }
  return { text: clean, title };
}

export async function processTextIngest({
  text,
  sourceUrl,
  title,
  userId,
}: {
  text: string;
  sourceUrl: string | null;
  title: string | null;
  userId: string;
}): Promise<IngestResult> {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    throw new Error("テキストが空です");
  }
  const source = sourceUrl ?? "(pasted text)";

  // Single-word / short-phrase path: the user highlighted a specific word
  // they want to learn. Bypass the article-extraction prompt and create
  // exactly one card via a dedicated schema + prompt.
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const isSingleWord = wordCount <= 3 && trimmed.length <= 40;

  const supabase = createAdminClient();
  const { data: ingestion, error: ingError } = await supabase
    .from("ingestions")
    .insert({
      user_id: userId,
      image_path: `text:${source}`,
      status: "pending",
    })
    .select()
    .single();
  if (ingError || !ingestion) {
    throw new Error(`ingestion record failed: ${ingError?.message}`);
  }

  try {
    const anthropic = getAnthropicClient();
    const sourceContext = title
      ? sourceUrl
        ? `${title} — ${sourceUrl}`
        : title
      : sourceUrl ?? null;

    if (isSingleWord) {
      const payload = `ユーザーがページ上で選択した語: "${trimmed}"
${title ? `ページ: ${title}\n` : ""}${sourceUrl ? `URL: ${sourceUrl}\n` : ""}
この語について単語カードを1枚作成してください。`;

      const result = await anthropic.messages.parse({
        // Haiku: one-word dictionary lookup — no reasoning, no vision.
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        system: SINGLE_WORD_PROMPT,
        messages: [{ role: "user", content: payload }],
        output_config: { format: zodOutputFormat(SingleWordSchema) },
      });
      const parsed = result.parsed_output;
      if (!parsed)
        throw new Error(
          `structured output missing (stop_reason: ${result.stop_reason})`
        );
      const w = parsed.word;
      const skipped = w.word === "__SKIP__";
      const inserts = skipped
        ? []
        : [
            {
              user_id: userId,
              word: w.word,
              reading: w.reading,
              part_of_speech: w.part_of_speech,
              definition_ja: w.definition_ja,
              definition_en: w.definition_en,
              example_en: w.example_en,
              example_ja: w.example_ja,
              etymology: w.etymology,
              difficulty: w.difficulty,
              frequency_rank: w.frequency_rank,
              related_words:
                w.related_words.length > 0 ? w.related_words : null,
              extra_examples:
                w.extra_examples.length > 0 ? w.extra_examples : null,
              source_image_path: null,
              source_context: sourceContext,
            },
          ];
      const { deduped: insertsDeduped, skipped: skippedSingle } =
        await dedupeInsertsAgainstDeck(supabase, userId, inserts);
      if (insertsDeduped.length > 0) {
        await rescueMissingFreqRanks(insertsDeduped);
        const { data: inserted, error: cardsError } = await supabase
          .from("cards")
          .insert(insertsDeduped)
          .select("id, word, part_of_speech, definition_ja, etymology");
        if (cardsError)
          throw new Error(`cards insert failed: ${cardsError.message}`);
        await attachDeepDivesToNewCards(supabase, inserted ?? []);
      }
      await supabase
        .from("ingestions")
        .update({
          status: "processed",
          raw_response: parsed as unknown as Record<string, unknown>,
          cards_created: insertsDeduped.length,
          processed_at: new Date().toISOString(),
        })
        .eq("id", ingestion.id);
      return {
        ingestion_id: ingestion.id,
        cards_created: insertsDeduped.length,
        words: insertsDeduped.map((c) => c.word),
        skipped_duplicates: skippedSingle,
      };
    }

    const payload = `以下のテキストから学習価値の高い英単語を抽出してカード化してください。

${sourceUrl ? `出典URL: ${sourceUrl}\n` : ""}${title ? `タイトル: ${title}\n` : ""}--- 本文 ---
${trimmed.slice(0, 18000)}`;

    const result = await anthropic.messages.parse({
      // Sonnet: text extraction from bookmarklet-selected passage — no vision,
      // structured output is well within its capability.
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: payload }],
      output_config: { format: zodOutputFormat(ExtractionSchema) },
    });

    const parsed = result.parsed_output;
    if (!parsed)
      throw new Error(
        `structured output missing (stop_reason: ${result.stop_reason})`
      );

    const cardsToInsert = parsed.words.map((w) => ({
      user_id: userId,
      word: w.word,
      reading: w.reading,
      part_of_speech: w.part_of_speech,
      definition_ja: w.definition_ja,
      definition_en: w.definition_en,
      example_en: w.example_en,
      example_ja: w.example_ja,
      etymology: w.etymology,
      difficulty: w.difficulty,
      frequency_rank: w.frequency_rank,
      related_words: w.related_words.length > 0 ? w.related_words : null,
      extra_examples: w.extra_examples.length > 0 ? w.extra_examples : null,
      source_image_path: null,
      source_context: sourceContext,
    }));

    const { deduped, skipped } = await dedupeInsertsAgainstDeck(
      supabase,
      userId,
      cardsToInsert
    );
    if (deduped.length > 0) {
      await rescueMissingFreqRanks(deduped);
      const { data: inserted, error: cardsError } = await supabase
        .from("cards")
        .insert(deduped)
        .select("id, word, part_of_speech, definition_ja, etymology");
      if (cardsError) throw new Error(`cards insert failed: ${cardsError.message}`);
      await attachDeepDivesToNewCards(supabase, inserted ?? []);
    }

    await supabase
      .from("ingestions")
      .update({
        status: "processed",
        raw_response: parsed as unknown as Record<string, unknown>,
        cards_created: deduped.length,
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);

    return {
      ingestion_id: ingestion.id,
      cards_created: deduped.length,
      words: deduped.map((c) => c.word),
      skipped_duplicates: skipped,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("ingestions")
      .update({
        status: "failed",
        error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);
    throw err;
  }
}

export async function processUrlIngest({
  url,
  userId,
}: {
  url: string;
  userId: string;
}): Promise<IngestResult> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URLは http:// または https:// で始めてください");
  }

  const supabase = createAdminClient();
  const { data: ingestion, error: ingError } = await supabase
    .from("ingestions")
    .insert({
      user_id: userId,
      image_path: `url:${url}`,
      status: "pending",
    })
    .select()
    .single();
  if (ingError || !ingestion) {
    throw new Error(`ingestion record failed: ${ingError?.message}`);
  }

  try {
    const { text, title } = await fetchArticleText(url);
    const anthropic = getAnthropicClient();
    const result = await anthropic.messages.parse({
      // Sonnet: article vocabulary extraction — no vision, large context but
      // well-structured. Opus was overkill.
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下のWebページ本文から学習価値の高い英単語を抽出してカード化してください。

出典URL: ${url}
${title ? `タイトル: ${title}\n` : ""}
--- 本文 ---
${text}`,
        },
      ],
      output_config: { format: zodOutputFormat(ExtractionSchema) },
    });

    const parsed = result.parsed_output;
    if (!parsed) throw new Error(`structured output missing (stop_reason: ${result.stop_reason})`);

    const cardsToInsert = parsed.words.map((w) => ({
      user_id: userId,
      word: w.word,
      reading: w.reading,
      part_of_speech: w.part_of_speech,
      definition_ja: w.definition_ja,
      definition_en: w.definition_en,
      example_en: w.example_en,
      example_ja: w.example_ja,
      etymology: w.etymology,
      difficulty: w.difficulty,
      frequency_rank: w.frequency_rank,
      related_words: w.related_words.length > 0 ? w.related_words : null,
      extra_examples: w.extra_examples.length > 0 ? w.extra_examples : null,
      source_image_path: null,
      source_context: title ? `${title} — ${url}` : url,
    }));

    const { deduped, skipped } = await dedupeInsertsAgainstDeck(
      supabase,
      userId,
      cardsToInsert
    );
    if (deduped.length > 0) {
      await rescueMissingFreqRanks(deduped);
      const { data: inserted, error: cardsError } = await supabase
        .from("cards")
        .insert(deduped)
        .select("id, word, part_of_speech, definition_ja, etymology");
      if (cardsError) throw new Error(`cards insert failed: ${cardsError.message}`);
      await attachDeepDivesToNewCards(supabase, inserted ?? []);
    }

    await supabase
      .from("ingestions")
      .update({
        status: "processed",
        raw_response: parsed as unknown as Record<string, unknown>,
        cards_created: deduped.length,
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);

    return {
      ingestion_id: ingestion.id,
      cards_created: deduped.length,
      words: deduped.map((c) => c.word),
      skipped_duplicates: skipped,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("ingestions")
      .update({
        status: "failed",
        error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);
    throw err;
  }
}
