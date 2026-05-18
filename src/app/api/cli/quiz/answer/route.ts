import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { schedule } from "@/lib/srs";
import type { Rating, ReviewFormat } from "@/lib/types";
import { requireAuth } from "../../_lib";

export const runtime = "nodejs";

// POST /api/cli/quiz/answer
// Body: { card_id: string, rating: 0|1|2|3, format?: "normal"|"cloze"|"typing" }
//
// Records the rating, updates the card's SM-2 state, and logs the review.
// Mirrors the server action grade() used by the in-app review screen so
// the CLI and the app remain on the same SRS trajectory.
export async function POST(req: NextRequest) {
  const a = requireAuth(req);
  if (!a.ok) return a.res;
  const userId = a.userId;

  let body: { card_id?: unknown; rating?: unknown; format?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const cardId = typeof body.card_id === "string" ? body.card_id : null;
  const ratingNum =
    typeof body.rating === "number" && [0, 1, 2, 3].includes(body.rating)
      ? (body.rating as Rating)
      : null;
  if (!cardId || ratingNum === null) {
    return NextResponse.json(
      { error: "card_id and rating(0-3) required" },
      { status: 400 }
    );
  }

  const fmt = body.format;
  const format: ReviewFormat =
    fmt === "cloze" || fmt === "typing" ? fmt : "normal";

  const supabase = createAdminClient();
  const { data: card, error: getErr } = await supabase
    .from("cards")
    .select(
      "id, user_id, ease_factor, interval_days, repetitions, status, was_intro_easy"
    )
    .eq("id", cardId)
    .eq("user_id", userId)
    .single();
  if (getErr || !card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  // Format-aware bump: successful cloze/typing recall counts one tier
  // stronger than recognition. Mirrors review/actions.ts behavior.
  let effectiveRating: Rating = ratingNum;
  if (format !== "normal" && ratingNum >= 1 && ratingNum < 3) {
    effectiveRating = (ratingNum + 1) as Rating;
  }

  const next = schedule(
    {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
    },
    effectiveRating
  );

  const updates: Record<string, unknown> = {
    ease_factor: next.ease_factor,
    interval_days: next.interval_days,
    repetitions: next.repetitions,
    next_review_at: next.next_review_at,
    last_reviewed_at: next.last_reviewed_at,
    status: next.status,
  };
  if (
    card.repetitions === 0 &&
    effectiveRating === 3 &&
    !card.was_intro_easy
  ) {
    updates.was_intro_easy = true;
  }

  const { error: upErr } = await supabase
    .from("cards")
    .update(updates)
    .eq("id", cardId)
    .eq("user_id", userId);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  await supabase.from("review_logs").insert({
    card_id: cardId,
    user_id: userId,
    rating: effectiveRating,
    prev_interval: card.interval_days,
    new_interval: next.interval_days,
    prev_ease: card.ease_factor,
    new_ease: next.ease_factor,
    format,
  });

  return NextResponse.json({
    card_id: cardId,
    rating: effectiveRating,
    next_review_at: next.next_review_at,
    interval_days: next.interval_days,
    status: next.status,
  });
}
