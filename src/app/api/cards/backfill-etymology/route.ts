import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 20;

const BatchOut = z.object({
  items: z.array(
    z.object({
      word: z.string(),
      etymology: z.string().nullable(),
    })
  ),
});

const PROMPT = `日本人英語学習者向けに、以下の英単語それぞれの語源を1-2文の日本語で簡潔に返してください。
- ラテン語/ギリシャ語/古英語/古フランス語など起源
- 有効な接頭辞・語根・接尾辞 (例: "e- 「外へ」 + ludere 「遊ぶ」")
- 関連語があれば1つ
- 分からないものは etymology: null
- 出力は入力と同じ word のみをキーに含めること`;

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
    const words = batch
      .map((c, n) => `${n + 1}. ${c.word}${c.part_of_speech ? ` (${c.part_of_speech})` : ""}`)
      .join("\n");

    try {
      const result = await anthropic.messages.parse({
        model: "claude-opus-4-7",
        max_tokens: 4000,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `以下の単語の語源をすべて返してください:\n\n${words}`,
          },
        ],
        output_config: { format: zodOutputFormat(BatchOut) },
      });
      const parsed = result.parsed_output;
      if (!parsed) throw new Error("missing parsed_output");

      const byWord = new Map<string, string | null>();
      for (const item of parsed.items) byWord.set(item.word.toLowerCase(), item.etymology);

      for (const c of batch) {
        const ety = byWord.get(c.word.toLowerCase());
        if (ety) {
          const { error: upd } = await supabase
            .from("cards")
            .update({ etymology: ety })
            .eq("id", c.id)
            .eq("user_id", userId);
          if (!upd) updated++;
          else failures.push(`${c.word}: ${upd.message}`);
        }
      }
    } catch (err) {
      failures.push(
        `batch ${i}-${i + BATCH}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const { count: remaining } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("etymology", null);

  return NextResponse.json({
    updated,
    remaining: remaining ?? 0,
    failures: failures.slice(0, 5),
  });
}
