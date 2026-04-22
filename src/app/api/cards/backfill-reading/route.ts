import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 25;

const BatchOut = z.object({
  readings: z.array(z.string().nullable()),
});

const PROMPT = `渡された英単語それぞれの発音記号(IPA)をスラッシュで囲んで返してください。

要件:
- 一般的なアメリカ英語の発音
- "/rʌn/" のように / で囲む
- 句(phrase)の場合は各語をスペース区切り。例: "look up" → "/lʊk ʌp/"
- 発音が不明な固有名詞などは null
- 入力の順序と同じ順序で readings 配列を返すこと（N個入力なら N個返す）`;

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
    .is("reading", null)
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
        // Haiku: IPA is a near-lookup task, no reasoning or stylistic quality needed.
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `以下 ${batch.length} 単語のIPA発音記号を同じ順序で返してください:\n\n${wordList}`,
          },
        ],
        output_config: { format: zodOutputFormat(BatchOut) },
      });

      const parsed = result.parsed_output;
      if (!parsed) throw new Error("missing parsed_output");
      if (parsed.readings.length !== batch.length) {
        throw new Error(
          `length mismatch: expected ${batch.length}, got ${parsed.readings.length}`
        );
      }

      for (let j = 0; j < batch.length; j++) {
        const raw = parsed.readings[j];
        if (!raw) continue;
        const reading = raw.trim();
        if (!reading) continue;
        const { error: upd } = await supabase
          .from("cards")
          .update({ reading })
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
    .is("reading", null);

  return NextResponse.json({
    processed: cards.length,
    updated,
    remaining: remaining ?? 0,
    failures: failures.slice(0, 5),
  });
}
