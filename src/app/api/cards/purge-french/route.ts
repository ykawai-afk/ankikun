import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 30;

const BatchOut = z.object({
  languages: z.array(z.enum(["english", "french", "other"])),
});

const PROMPT = `以下の vocabulary カードについて、word と definition_ja を見て、カードの見出し語が「現代英語の語彙として英語話者が通常使う語かどうか」を判定してください。

- "english": 英語として一般的に使う（借用語 "faux pas", "concierge", "cliché" 等も english とする）
- "french": 英語話者が普通は使わない純粋フランス語（"ringarde", "aux faux", "l'amour", 固有の成句等）
- "other": 判定不能、固有名詞、その他

入力と同じ順序で languages 配列を返してください。N個入力→N個出力。`;

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "INGEST_USER_ID not set" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    dry_run?: boolean;
    limit?: number;
  };
  const dry = body.dry_run === true;
  const limit = Math.min(Math.max(body.limit ?? 1500, 1), 2000);

  const supabase = createAdminClient();
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, word, definition_ja")
    .eq("user_id", userId)
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cards?.length) return NextResponse.json({ checked: 0, deleted: 0, french: [] });

  const anthropic = getAnthropicClient();
  const frenchIds: string[] = [];
  const frenchWords: string[] = [];
  const failures: string[] = [];

  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const list = batch
      .map(
        (c, n) =>
          `${n + 1}. ${c.word} — ${(c.definition_ja ?? "").slice(0, 80)}`
      )
      .join("\n");
    try {
      const result = await anthropic.messages.parse({
        // Haiku: binary "is this word French vs English" classification.
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `以下 ${batch.length} カードを判定してください:\n\n${list}`,
          },
        ],
        output_config: { format: zodOutputFormat(BatchOut) },
      });
      const parsed = result.parsed_output;
      if (!parsed) throw new Error("missing parsed_output");
      if (parsed.languages.length !== batch.length) {
        throw new Error(
          `length mismatch ${parsed.languages.length}/${batch.length}`
        );
      }
      for (let j = 0; j < batch.length; j++) {
        if (parsed.languages[j] === "french") {
          frenchIds.push(batch[j].id);
          frenchWords.push(batch[j].word);
        }
      }
    } catch (err) {
      failures.push(
        `batch ${i}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  let deleted = 0;
  if (!dry && frenchIds.length > 0) {
    const { count, error: delErr } = await supabase
      .from("cards")
      .delete({ count: "exact" })
      .in("id", frenchIds)
      .eq("user_id", userId);
    if (delErr) {
      return NextResponse.json(
        { error: delErr.message, french: frenchWords },
        { status: 500 }
      );
    }
    deleted = count ?? frenchIds.length;
  }

  return NextResponse.json({
    checked: cards.length,
    matched: frenchIds.length,
    deleted,
    french: frenchWords,
    failures: failures.slice(0, 5),
    dry_run: dry,
  });
}
