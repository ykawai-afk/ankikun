import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 10;

const RelatedWord = z.object({
  word: z.string(),
  part_of_speech: z.string().nullable(),
  meaning_ja: z.string(),
});

const BatchOut = z.object({
  groups: z.array(z.array(RelatedWord)),
});

const PROMPT = `日本人学習者のために、渡された英単語それぞれについて word family (同じ語根の派生語) を返してください。

要件:
- 単語ごとに 2〜4 個の関連語
- 一般的で実用的な語のみ（頻度の低いものは除外）
- 各 related word に part_of_speech と meaning_ja(日本語訳)を付ける
- 該当がない単語は空配列 []
- 入力と同じ順序で groups 配列を返す (N 個入力なら N 個)`;

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
  const limit = Math.min(Math.max(body.limit ?? 200, 1), 500);

  const supabase = createAdminClient();
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, word, part_of_speech")
    .eq("user_id", userId)
    .is("related_words", null)
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
          `${n + 1}. ${c.word}${c.part_of_speech ? ` (${c.part_of_speech})` : ""}`
      )
      .join("\n");

    try {
      const result = await anthropic.messages.parse({
        // Sonnet: word-family derivation is deterministic morphology, no deep reasoning needed.
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `以下 ${batch.length} 単語の word family を返してください:\n\n${list}`,
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
        const related = group.length > 0 ? group : [];
        const { error: upd } = await supabase
          .from("cards")
          .update({ related_words: related.length > 0 ? related : null })
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
    .is("related_words", null);

  return NextResponse.json({
    processed: cards.length,
    updated,
    remaining: remaining ?? 0,
    failures: failures.slice(0, 5),
  });
}
