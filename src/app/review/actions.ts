"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { schedule } from "@/lib/srs";
import type { Card, Rating } from "@/lib/types";

export async function grade(cardId: string, rating: Rating) {
  const supabase = await createClient();

  const { data: card, error } = await supabase
    .from("cards")
    .select("*")
    .eq("id", cardId)
    .single<Card>();
  if (error || !card) throw new Error("card not found");

  const next = schedule(
    {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
    },
    rating
  );

  const { error: updateErr } = await supabase
    .from("cards")
    .update({
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      next_review_at: next.next_review_at,
      last_reviewed_at: next.last_reviewed_at,
      status: next.status,
    })
    .eq("id", cardId);
  if (updateErr) throw updateErr;

  await supabase.from("review_logs").insert({
    card_id: card.id,
    user_id: card.user_id,
    rating,
    prev_interval: card.interval_days,
    new_interval: next.interval_days,
    prev_ease: card.ease_factor,
    new_ease: next.ease_factor,
  });

  revalidatePath("/review");
  redirect("/review");
}
