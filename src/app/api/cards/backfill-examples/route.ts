import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 10;

const Example = z.object({
  en: z.string(),
  ja: z.string(),
  register: z.enum(["formal", "conversational", "idiom"]).nullable(),
});

const BatchOut = z.object({
  groups: z.array(z.array(Example)),
});

const PROMPT = `日本人学習者向けに、渡された各英単語について追加の例文を生成してください。

要件:
- 単語ごとに 2〜3 個の例文
- **日常で実際にあり得るシーンのみ** (職場メール/Slack、友人との会話、家族、旅行、ショッピング、ニュース、家事、趣味など)
- register を多様化:
  - "formal" = 職場メール/会議/ビジネス文書 (普通の会社員レベル。法律/学術論文は禁止)
  - "conversational" = カジュアルな会話
  - "idiom" = 実際に会話で使われる慣用表現
- **禁止**: 文学調 / 哲学的 / 論文調 / 抽象的で不自然な例文 / 普通の生活で出会わない珍しいシナリオ
  ✅良い例 (mitigate): "I took ginger to mitigate the motion sickness on the bus."
  ❌悪い例 (mitigate): "Philosophers have long sought to mitigate the existential dread of mortality."
- 自然な英文 + 自然な日本語訳
- 既出の典型例文とは違う文脈
- 入力と同じ順序で groups 配列を返すこと (N 個入力なら N 個)`;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "INGEST_USER_ID not set" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 150, 1), 500);

  const supabase = createAdminClient();
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja")
    .eq("user_id", userId)
    .is("extra_examples", null)
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cards?.length) return NextResponse.json({ updated: 0, remaining: 0 });

  const anthropic = getAnthropicClient();
  let updated = 0;
  const failures: string[] = [];

  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const list = batch
      .map(
        (c, n) =>
          `${n + 1}. ${c.word}${c.part_of_speech ? ` (${c.part_of_speech})` : ""} — ${c.definition_ja}`
      )
      .join("\n");

    try {
      const result = await anthropic.messages.parse({
        model: "claude-opus-4-7",
        max_tokens: 10000,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `以下 ${batch.length} 単語それぞれに追加例文を返してください:\n\n${list}`,
          },
        ],
        output_config: { format: zodOutputFormat(BatchOut) },
      });
      const parsed = result.parsed_output;
      if (!parsed) throw new Error("missing parsed_output");
      if (parsed.groups.length !== batch.length) {
        throw new Error(
          `length mismatch: expected ${batch.length}, got ${parsed.groups.length}`
        );
      }
      for (let j = 0; j < batch.length; j++) {
        const group = parsed.groups[j];
        const { error: upd } = await supabase
          .from("cards")
          .update({ extra_examples: group.length > 0 ? group : null })
          .eq("id", batch[j].id)
          .eq("user_id", userId);
        if (!upd) updated++;
        else failures.push(`${batch[j].word}: ${upd.message}`);
      }
    } catch (err) {
      failures.push(
        `batch ${i}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const { count: remaining } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("extra_examples", null);

  return NextResponse.json({
    processed: cards.length,
    updated,
    remaining: remaining ?? 0,
    failures: failures.slice(0, 5),
  });
}
