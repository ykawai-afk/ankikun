"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import type { CardStatus } from "@/lib/types";

export type CardEditInput = {
  word: string;
  reading: string | null;
  part_of_speech: string | null;
  definition_ja: string;
  definition_en: string | null;
  example_en: string | null;
  example_ja: string | null;
  etymology: string | null;
  tags: string[] | null;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateCard(
  cardId: string,
  input: CardEditInput
): Promise<ActionResult> {
  const word = input.word.trim();
  const definition_ja = input.definition_ja.trim();
  if (!word || !definition_ja) {
    return { ok: false, error: "word と definition_ja は必須です" };
  }

  const supabase = createAdminClient();
  const userId = getUserId();

  const { error } = await supabase
    .from("cards")
    .update({
      word,
      reading: input.reading?.trim() || null,
      part_of_speech: input.part_of_speech?.trim() || null,
      definition_ja,
      definition_en: input.definition_en?.trim() || null,
      example_en: input.example_en?.trim() || null,
      example_ja: input.example_ja?.trim() || null,
      etymology: input.etymology?.trim() || null,
      tags: input.tags && input.tags.length > 0 ? input.tags : null,
    })
    .eq("id", cardId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/cards");
  revalidatePath("/");
  return { ok: true };
}

export async function setCardStatus(
  cardId: string,
  status: CardStatus
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const userId = getUserId();
  const { error } = await supabase
    .from("cards")
    .update({ status })
    .eq("id", cardId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cards");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCard(cardId: string): Promise<ActionResult> {
  const supabase = createAdminClient();
  const userId = getUserId();
  const { error } = await supabase
    .from("cards")
    .delete()
    .eq("id", cardId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cards");
  revalidatePath("/");
  return { ok: true };
}
