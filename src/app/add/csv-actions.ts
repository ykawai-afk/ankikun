"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";

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
  return { ok: true, cardsCreated: rows.length };
}
