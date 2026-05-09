"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { CACHE_TAGS } from "@/lib/cache";

export type CsvCard = {
  word: string;
  reading: string | null;
  part_of_speech: string | null;
  definition_ja: string;
  definition_en: string | null;
  example_en: string | null;
  example_ja: string | null;
  etymology: string | null;
};

export type CsvExpression = {
  expression: string;
  note: string;
};

export type CsvAddResult =
  | { ok: true; cardsCreated: number }
  | { ok: false; error: string };

export async function addFromCsv(cards: CsvCard[]): Promise<CsvAddResult> {
  if (!Array.isArray(cards) || cards.length === 0) {
    return { ok: false, error: "有効な行がありません" };
  }
  if (cards.length > 500) {
    return {
      ok: false,
      error: `一度に追加できるのは500件までです（${cards.length}件）`,
    };
  }

  const userId = getUserId();
  const supabase = createAdminClient();

  const rows = cards.map((c) => ({
    user_id: userId,
    card_type: "word" as const,
    word: c.word.trim(),
    reading: c.reading?.trim() || null,
    part_of_speech: c.part_of_speech?.trim() || null,
    definition_ja: c.definition_ja.trim(),
    definition_en: c.definition_en?.trim() || null,
    example_en: c.example_en?.trim() || null,
    example_ja: c.example_ja?.trim() || null,
    etymology: c.etymology?.trim() || null,
  }));

  const { error } = await supabase.from("cards").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/cards");
  updateTag(CACHE_TAGS.cards);
  return { ok: true, cardsCreated: rows.length };
}

// Bulk-load expression cards (English phrases practiced via ChatGPT voice
// roleplay). Maps the user-facing CSV columns onto the existing cards table:
// word = English expression, definition_ja = Japanese situational note.
export async function addExpressionsFromCsv(
  rows: CsvExpression[]
): Promise<CsvAddResult> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "有効な行がありません" };
  }
  if (rows.length > 500) {
    return {
      ok: false,
      error: `一度に追加できるのは500件までです（${rows.length}件）`,
    };
  }

  const userId = getUserId();
  const supabase = createAdminClient();

  const inserts = rows.map((r) => ({
    user_id: userId,
    card_type: "expression" as const,
    word: r.expression.trim(),
    definition_ja: r.note.trim(),
  }));

  const { error } = await supabase.from("cards").insert(inserts);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath("/review/expression");
  updateTag(CACHE_TAGS.cards);
  return { ok: true, cardsCreated: inserts.length };
}
