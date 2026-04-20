import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 15;

const BatchOut = z.object({
  etymologies: z.array(z.string().nullable()),
});

const PROMPT = `日本人英語学習者向けに、渡された英単語それぞれの語源を1-2文の日本語で簡潔に書いてください。

要件:
- ラテン語/ギリシャ語/古英語/古フランス語など起源を明記
- 意味のある接頭辞・語根・接尾辞を分解（例: "e- 「外へ」 + ludere 「遊ぶ」"）
- 関連語があれば1つ添える
- 明確な語源がわからない場合は null
- 入力の順序と同じ順序で etymologies 配列を返すこと（N個入力なら N個返す）`;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.INGEST_TOKEN}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "INGEST_USER_ID not configured" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 500, 1), 500);

  const supabase = createAdminClient();
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, word, part_of_speech")
    .eq("user_id", userId)
    .is("etymology", null)
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cards || cards.length === 0) {
    return NextResponse.json({ updated: 0, remaining: 0 });
  }

  const anthropic = getAnthropicClient();
  let updated = 0;
  const failures: string[] = [];

  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const wordList = batch
      .map(
        (c, n) =>
          `${n + 1}. ${c.word}${c.part_of_speech ? ` (${c.part_of_speech})` : ""}`
      )
      .join("\n");

    try {
      const result = await anthropic.messages.parse({
        model: "claude-opus-4-7",
        max_tokens: 8000,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `以下 ${batch.length} 単語の語源を同じ順序で返してください:\n\n${wordList}`,
          },
        ],
        output_config: { format: zodOutputFormat(BatchOut) },
      });

      const parsed = result.parsed_output;
      if (!parsed) throw new Error("missing parsed_output");
      if (parsed.etymologies.length !== batch.length) {
        throw new Error(
          `length mismatch: expected ${batch.length}, got ${parsed.etymologies.length}`
        );
      }

      for (let j = 0; j < batch.length; j++) {
        const ety = parsed.etymologies[j];
        if (!ety) continue;
        const { error: upd } = await supabase
          .from("cards")
          .update({ etymology: ety })
          .eq("id", batch[j].id)
          .eq("user_id", userId);
        if (!upd) updated++;
        else failures.push(`${batch[j].word}: ${upd.message}`);
      }
    } catch (err) {
      failures.push(
        `batch ${i}-${i + batch.length}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  const { count: remaining } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("etymology", null);

  return NextResponse.json({
    processed: cards.length,
    updated,
    remaining: remaining ?? 0,
    failures: failures.slice(0, 5),
  });
}
