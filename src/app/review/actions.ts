"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { schedule } from "@/lib/srs";
import type { Card, Rating, ReviewFormat } from "@/lib/types";
import { CACHE_TAGS } from "@/lib/cache";
import { isIntroLog } from "@/lib/mastery";

// Cloze and typing formats both require active retrieval (context recall
// or production), so a successful grading there is SRS-stronger than the
// same button press on a front/back card. Bump one tier for non-Again
// ratings; misses always stay Again regardless of format.
function applyFormatBump(rating: Rating, format: ReviewFormat): Rating {
  if (rating === 0) return 0;
  if (format === "normal") return rating;
  return Math.min(3, rating + 1) as Rating;
}

// Best-effort background grade. The client optimistically advances its queue
// and this updates the DB without forcing a re-render.
export async function grade(
  cardId: string,
  rating: Rating,
  format: ReviewFormat = "normal"
) {
  const supabase = createAdminClient();
  const userId = getUserId();

  const { data: card, error } = await supabase
    .from("cards")
    .select("*")
    .eq("id", cardId)
    .eq("user_id", userId)
    .single<Card>();
  if (error || !card) throw new Error("card not found");

  const effectiveRating = applyFormatBump(rating, format);
  const next = schedule(
    {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
    },
    effectiveRating
  );

  // Intro-Easy shortcut: if this grading is the card's very first rating
  // (interval 0, ease still at 2.5) AND the effective rating resolves to
  // Easy, stamp was_intro_easy=true so the mastery check can count it
  // immediately. Uses effective_rating so a cloze/typing Good (bumped to
  // Easy) on a brand-new card still qualifies.
  const introEasy =
    isIntroLog({ prev_interval: card.interval_days, prev_ease: card.ease_factor }) &&
    effectiveRating === 3;

  const { error: updateErr } = await supabase
    .from("cards")
    .update({
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      next_review_at: next.next_review_at,
      last_reviewed_at: next.last_reviewed_at,
      status: next.status,
      ...(introEasy ? { was_intro_easy: true } : {}),
    })
    .eq("id", cardId);
  if (updateErr) throw updateErr;

  await supabase.from("review_logs").insert({
    card_id: card.id,
    user_id: userId,
    rating: effectiveRating,
    prev_interval: card.interval_days,
    new_interval: next.interval_days,
    prev_ease: card.ease_factor,
    new_ease: next.ease_factor,
    prev_repetitions: card.repetitions,
    prev_status: card.status,
    format,
  });

  revalidatePath("/");
  revalidatePath("/cards");
  updateTag(CACHE_TAGS.cards);
  updateTag(CACHE_TAGS.reviewLogs);
}

// Reverse the most recent grading for this card: restores the pre-grade
// SRS state from review_logs and deletes that log row. Intended to be
// called from the review UI within a short window after a grading. If the
// undone grading was an intro-Easy (rating=3 with prev_interval=0, prev_ease=2.5)
// then was_intro_easy is flipped back to false since that grading was the
// sole source of the flag.
export async function undoLastGrade(cardId: string): Promise<{ ok: boolean }> {
  const supabase = createAdminClient();
  const userId = getUserId();

  const { data: log, error: logErr } = await supabase
    .from("review_logs")
    .select("*")
    .eq("card_id", cardId)
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (logErr || !log) return { ok: false };

  // Older logs (pre-migration 0010) lack prev_repetitions/prev_status. We
  // refuse to undo those rather than guess — keeps restoration exact.
  if (log.prev_repetitions == null || log.prev_status == null) {
    return { ok: false };
  }

  const wasIntroEasy =
    log.prev_interval === 0 && log.prev_ease === 2.5 && log.rating === 3;

  const update: Record<string, unknown> = {
    ease_factor: log.prev_ease,
    interval_days: log.prev_interval,
    repetitions: log.prev_repetitions,
    status: log.prev_status,
    last_reviewed_at: null,
    // Card becomes due immediately again so the queue picks it up.
    next_review_at: new Date().toISOString(),
  };
  if (wasIntroEasy) update.was_intro_easy = false;

  const { error: updErr } = await supabase
    .from("cards")
    .update(update)
    .eq("id", cardId)
    .eq("user_id", userId);
  if (updErr) return { ok: false };

  await supabase.from("review_logs").delete().eq("id", log.id);

  revalidatePath("/");
  revalidatePath("/cards");
  updateTag(CACHE_TAGS.cards);
  updateTag(CACHE_TAGS.reviewLogs);
  return { ok: true };
}
