import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import type { DeepDive } from "@/lib/types";

// Shared deep_dive generator. Used by:
//  - /api/cards/[id]/deep-dive (on-demand regeneration)
//  - ingest flows (auto-attached to every new card)
//  - scripts/backfill-deep-dive.mjs (retrofits existing cards)
//
// Sonnet is the right model: structured etymology + cognates output is
// well within its capability, and Opus is overkill for the data shape.

export const DeepDiveSchema = z.object({
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

export const DEEP_DIVE_SYSTEM_PROMPT = `あなたは英単語学習アシスタント。
対象語の語根を分解し、同根語ネットワークを示すことで「この1語を覚えると5-10語が解ける」ような実用的な知見を提供します。

出力:
- roots: 接頭辞/語根/接尾辞に分割。segment(分割片), origin(由来: Latin/Greek/Old English等、不明ならnull), meaning(日本語での意味)。3-4要素が理想
- cognates: 同じ語根/接頭辞を共有する別の英単語3-5個。{word, meaning_ja}。学習者に役立つ語を優先し、obscureな語は避ける
- hook: 語根の意味と対象語の意味を結ぶ1文の記憶フック。絵的で構わない。ダサくても実用性優先。

ルール:
- 語源が不明または分解できない語の場合は、rootsに1要素だけ返し meaning に説明を書く
- cognatesは最低3個返す (ネットワーク効果がこの機能の核心)
- hookは20-60字、日本語で`;

export async function generateDeepDive(card: {
  word: string;
  part_of_speech?: string | null;
  definition_ja: string;
  etymology?: string | null;
}): Promise<DeepDive | null> {
  const anthropic = getAnthropicClient();
  const userMessage = [
    `対象: ${card.word}${card.part_of_speech ? ` (${card.part_of_speech})` : ""}`,
    `意味: ${card.definition_ja}`,
    card.etymology ? `参考語源メモ: ${card.etymology}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await anthropic.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: DEEP_DIVE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(DeepDiveSchema) },
    });
    return result.parsed_output ?? null;
  } catch (err) {
    console.error("generateDeepDive failed", card.word, err);
    return null;
  }
}
