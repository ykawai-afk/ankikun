import crypto from "node:crypto";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const ALLOWED_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

const WordSchema = z.object({
  word: z.string(),
  reading: z.string().nullable(),
  part_of_speech: z.string().nullable(),
  definition_ja: z.string(),
  definition_en: z.string().nullable(),
  example_en: z.string().nullable(),
  example_ja: z.string().nullable(),
});

const ExtractionSchema = z.object({
  source_context: z.string().nullable(),
  words: z.array(WordSchema),
});

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
- example_en: その単語を使った自然な例文1つ
- example_ja: example_enの自然な日本語訳
- source_context: スクショの文脈(1文、なくてよければnull)`;

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
      source_image_path: imagePath,
      source_context: parsed.source_context,
    }));

    if (cardsToInsert.length > 0) {
      const { error: cardsError } = await supabase.from("cards").insert(cardsToInsert);
      if (cardsError) throw new Error(`cards insert failed: ${cardsError.message}`);
    }

    await supabase
      .from("ingestions")
      .update({
        status: "processed",
        raw_response: parsed as unknown as Record<string, unknown>,
        cards_created: cardsToInsert.length,
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestion.id);

    return {
      ingestion_id: ingestion.id,
      cards_created: cardsToInsert.length,
      words: parsed.words.map((w) => w.word),
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
