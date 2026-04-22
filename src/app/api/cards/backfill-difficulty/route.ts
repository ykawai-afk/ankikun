import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Batch ~20 cards per Claude call — the output (one CEFR tag per word) is
// small so we can push this higher than the example backfill.
const BATCH = 20;

const CEFR = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).nullable();
const Out = z.object({
  levels: z.array(CEFR),
});

const PROMPT = `渡される英単語それぞれに CEFR レベル (A1, A2, B1, B2, C1, C2) を判定してください。

基準:
- A1 (500語圏): 中学1-2年の基本語 (go, have, big)
- A2 (1000語圏): 中学3年〜高校1年 (explain, decide, industry)
- B1 (2500語圏): 高校標準 (accept, argue, provide, trend)
- B2 (4000語圏): 高校上位〜TOEIC700 (intervene, peculiar, strive, comprehend)
- C1 (8000語圏): 英検1級〜TOEIC900 (acute, conducive, elusive, scrutinize)
- C2 (15000+語圏): 学術・希少語 (pugnacious, obsequious, ephemeral, cognizant)

- 確信持てない場合のみ null (英語としてそもそも成立してない等)
- phrase / idiom は構成要素の中で一番難しい語に合わせる
- 入力と同じ順序で levels 配列を返すこと (N 個入力なら N 個)`;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "INGEST_USER_ID not set" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
    force?: boolean;
  };
  const force = body.force === true;
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 500);

  const supabase = createAdminClient();
  const query = supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja")
    .eq("user_id", userId)
    .neq("status", "suspended")
    .limit(limit);
  if (!force) query.is("difficulty", null);
  const { data: cards, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!cards?.length) {
    return NextResponse.json({ processed: 0, updated: 0, remaining: 0 });
  }

  const anthropic = getAnthropicClient();
  let updated = 0;
  const failures: string[] = [];

  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const list = batch
      .map(
        (c, n) =>
          `${n + 1}. ${c.word}${c.part_of_speech ? ` (${c.part_of_speech})` : ""}`
      )
      .join("\n");

    try {
      const result = await anthropic.messages.parse({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `以下 ${batch.length} 単語の CEFR を返してください:\n\n${list}`,
          },
        ],
        output_config: { format: zodOutputFormat(Out) },
      });
      const parsed = result.parsed_output;
      if (!parsed) throw new Error("missing parsed_output");
      if (parsed.levels.length !== batch.length) {
        throw new Error(
          `length mismatch: expected ${batch.length}, got ${parsed.levels.length}`
        );
      }
      for (let j = 0; j < batch.length; j++) {
        const level = parsed.levels[j];
        const { error: upd } = await supabase
          .from("cards")
          .update({ difficulty: level })
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
    .is("difficulty", null);

  return NextResponse.json({
    processed: cards.length,
    updated,
    remaining: remaining ?? 0,
    failures: failures.slice(0, 5),
  });
}
