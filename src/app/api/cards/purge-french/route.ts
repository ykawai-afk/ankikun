import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 25;

const BatchOut = z.object({
  languages: z.array(z.enum(["english", "french", "other"])),
});

const PROMPT = `以下の英単語カードの word を見て、言語を判定してください。
- "english": 現代英語として一般的な語 (借用語であってもネイティブが普通に使うもの)
- "french": フランス語として使われる語、英語では使わない純粋フランス語
- "other": それ以外
入力と同じ順で languages 配列を返してください。N個入力→N個出力。`;

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "INGEST_USER_ID not set" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
    dry_run?: boolean;
  };
  const limit = Math.min(Math.max(body.limit ?? 300, 1), 600);
  const dry = body.dry_run === true;

  const supabase = createAdminClient();
  const FRENCH_ACCENTS =
    "word.ilike.%é%,word.ilike.%è%,word.ilike.%ê%,word.ilike.%à%,word.ilike.%â%,word.ilike.%ô%,word.ilike.%î%,word.ilike.%ï%,word.ilike.%ù%,word.ilike.%û%,word.ilike.%ç%,word.ilike.%ë%,word.ilike.%œ%,word.ilike.%æ%";

  // Strategy A: direct delete where any JP field mentions フランス語 / 仏語 / 仏: etc.
  const { data: directHits } = await supabase
    .from("cards")
    .select("id, word")
    .eq("user_id", userId)
    .or(
      "definition_ja.ilike.%フランス語%,definition_ja.ilike.%仏語%,definition_ja.ilike.%（仏）%,definition_ja.ilike.%(仏)%,etymology.ilike.%フランス語%,etymology.ilike.%French%,example_ja.ilike.%フランス語%"
    )
    .limit(limit);

  const directIds = (directHits ?? []).map((c) => c.id);
  const directWords = (directHits ?? []).map((c) => c.word);

  if (!dry && directIds.length > 0) {
    await supabase
      .from("cards")
      .delete()
      .in("id", directIds)
      .eq("user_id", userId);
  }

  // Strategy B: accented words, let Claude classify
  const { data: accented } = await supabase
    .from("cards")
    .select("id, word")
    .eq("user_id", userId)
    .or(FRENCH_ACCENTS)
    .limit(limit);

  const candidates = (accented ?? []).slice(0, limit);
  if (candidates.length === 0 && directIds.length === 0) {
    return NextResponse.json({ checked: 0, deleted: 0, french: [] });
  }
  if (candidates.length === 0) {
    return NextResponse.json({
      checked: 0,
      deleted: directIds.length,
      french: directWords,
      dry_run: dry,
    });
  }

  const anthropic = getAnthropicClient();
  const frenchIds: string[] = [];
  const frenchWords: string[] = [];
  const failures: string[] = [];

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const list = batch.map((c, n) => `${n + 1}. ${c.word}`).join("\n");
    try {
      const result = await anthropic.messages.parse({
        model: "claude-opus-4-7",
        max_tokens: 1000,
        system: PROMPT,
        messages: [
          {
            role: "user",
            content: `以下 ${batch.length} 単語の言語を同じ順で返してください:\n\n${list}`,
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

  let deleted = directIds.length;
  if (!dry && frenchIds.length > 0) {
    const { error, count } = await supabase
      .from("cards")
      .delete({ count: "exact" })
      .in("id", frenchIds)
      .eq("user_id", userId);
    if (error)
      return NextResponse.json(
        { error: error.message, french: [...directWords, ...frenchWords] },
        { status: 500 }
      );
    deleted += count ?? frenchIds.length;
  }

  return NextResponse.json({
    checked: candidates.length,
    deleted,
    french: [...directWords, ...frenchWords],
    failures: failures.slice(0, 5),
    dry_run: dry,
  });
}
