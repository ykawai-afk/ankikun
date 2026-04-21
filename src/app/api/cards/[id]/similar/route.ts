import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 30;

const CANDIDATE_POOL = 300;

const SimilarSchema = z.object({
  similar: z
    .array(
      z.object({
        id: z.string(),
        reason: z.string(),
      })
    )
    .max(3),
});

const SYSTEM_PROMPT = `あなたは英語学習者のカード混同を検出するアシスタント。
ターゲット英単語1つと、候補カードのリストが与えられます。
ターゲットと「混同されやすい」語を候補の中から最大3つ選んでください。

混同の要因 (以下のいずれかが該当すれば選ぶ):
1. 音/発音が近い (affect/effect, accept/except, principal/principle)
2. 綴りが似ている (desert/dessert, complement/compliment)
3. 意味が近く使い分けが難しい (small/little, look/see/watch)
4. 用法パターンや典型的コロケーションが重なる

ルール:
- 候補idをそのまま返す (新しい語は作らない)
- ターゲット語自身は選ばない
- 明らかに関係ない語は選ばない。該当なければ空配列でよい
- reason は日本語10-25字で「何が似てるか」を簡潔に (例: "意味が近い", "スペル1字違い", "発音が紛らわしい")
- 質より量を優先しない。本当に混同しやすい2-3語に絞る`;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();
  const supabase = createAdminClient();

  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja, definition_en, reading")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (cardErr || !card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  const { data: candidates, error: candErr } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja, reading")
    .eq("user_id", userId)
    .neq("id", id)
    .neq("status", "suspended")
    .order("last_reviewed_at", { ascending: false, nullsFirst: false })
    .limit(CANDIDATE_POOL);

  if (candErr) {
    return NextResponse.json({ error: candErr.message }, { status: 500 });
  }

  const pool = candidates ?? [];
  if (pool.length === 0) {
    return NextResponse.json({ similar: [] });
  }

  const userMessage = [
    `ターゲット: ${card.word}${
      card.part_of_speech ? ` (${card.part_of_speech})` : ""
    }${card.reading ? ` /${card.reading.replace(/\//g, "")}/` : ""}`,
    `意味: ${card.definition_ja}`,
    card.definition_en ? `英英: ${card.definition_en}` : null,
    "",
    `候補 (${pool.length}語):`,
    ...pool.map(
      (c) =>
        `${c.id}|${c.word}${
          c.part_of_speech ? `(${c.part_of_speech})` : ""
        }${c.reading ? ` /${c.reading.replace(/\//g, "")}/` : ""}|${
          c.definition_ja
        }`
    ),
  ]
    .filter((s): s is string => s !== null)
    .join("\n");

  const anthropic = getAnthropicClient();
  let parsed: z.infer<typeof SimilarSchema> | null = null;
  try {
    const result = await anthropic.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(SimilarSchema) },
    });
    parsed = result.parsed_output;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  if (!parsed) {
    return NextResponse.json({ similar: [] });
  }

  const byId = new Map(pool.map((c) => [c.id, c]));
  const enriched = parsed.similar
    .map((s) => {
      const c = byId.get(s.id);
      if (!c) return null;
      return {
        id: c.id,
        word: c.word,
        definition_ja: c.definition_ja,
        part_of_speech: c.part_of_speech,
        reading: c.reading,
        reason: s.reason,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return NextResponse.json({ similar: enriched });
}
