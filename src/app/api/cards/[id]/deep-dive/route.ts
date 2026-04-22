import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 60;

const DeepDiveSchema = z.object({
  roots: z
    .array(
      z.object({
        segment: z.string(),
        origin: z.string().nullable(),
        meaning: z.string(),
      })
    )
    .min(1)
    .max(4),
  cognates: z
    .array(
      z.object({
        word: z.string(),
        meaning_ja: z.string(),
      })
    )
    .max(6),
  hook: z.string(),
});

const SYSTEM_PROMPT = `あなたは英単語学習アシスタント。
対象語の語根を分解し、同根語ネットワークを示すことで「この1語を覚えると5-10語が解ける」ような実用的な知見を提供します。

出力:
- roots: 接頭辞/語根/接尾辞に分割。segment(分割片), origin(由来: Latin/Greek/Old English等、不明ならnull), meaning(日本語での意味)。3-4要素が理想
- cognates: 同じ語根/接頭辞を共有する別の英単語3-5個。{word, meaning_ja}。学習者に役立つ語を優先し、obscureな語は避ける
- hook: 語根の意味と対象語の意味を結ぶ1文の記憶フック。絵的で構わない。ダサくても実用性優先。

ルール:
- 語源が不明または分解できない語の場合は、rootsに1要素だけ返し meaning に説明を書く
- cognatesは最低3個返す (ネットワーク効果がこの機能の核心)
- hookは20-60字、日本語で`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();
  const supabase = createAdminClient();

  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja, etymology")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (cardErr || !card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { regenerate?: boolean };

  if (!body.regenerate) {
    const { data: existing } = await supabase
      .from("cards")
      .select("deep_dive")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (existing?.deep_dive) {
      return NextResponse.json({ deep_dive: existing.deep_dive });
    }
  }

  const anthropic = getAnthropicClient();
  const userMessage = [
    `対象: ${card.word}${card.part_of_speech ? ` (${card.part_of_speech})` : ""}`,
    `意味: ${card.definition_ja}`,
    card.etymology ? `参考語源メモ: ${card.etymology}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await anthropic.messages.parse({
    // Sonnet: structured etymology/cognates output without the Opus premium.
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    output_config: { format: zodOutputFormat(DeepDiveSchema) },
  });

  const parsed = result.parsed_output;
  if (!parsed) {
    return NextResponse.json(
      { error: `generation failed (${result.stop_reason})` },
      { status: 502 }
    );
  }

  const { error: updErr } = await supabase
    .from("cards")
    .update({ deep_dive: parsed })
    .eq("id", id)
    .eq("user_id", userId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ deep_dive: parsed });
}
