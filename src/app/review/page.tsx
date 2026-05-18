import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { ReviewSession } from "./review-session";
import type { Card } from "@/lib/types";
import {
  DAILY_NEW_TARGET,
  DAILY_SESSION_TARGET,
  countNewIntrosSince,
  jstStartOfDay,
} from "@/lib/goals";

export const dynamic = "force-dynamic";

// Cap on how many overdue cards we even consider for slicing into today's
// session — keeps the query bounded when a long gap has piled up reviews.
const REVIEW_FETCH_CAP = 300;
const CARD_COLUMNS =
  "id, user_id, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, user_note, audio_url, difficulty, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at";

export default async function ReviewPage() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();
  const dayStart = jstStartOfDay().toISOString();

  // Already-graded reviews today eat into the session ceiling. Counting raw
  // log rows (not unique cards) matches the home progress meter.
  const [{ count: gradedTodayCount }, newIntrosToday] = await Promise.all([
    supabase
      .from("review_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("reviewed_at", dayStart),
    countNewIntrosSince(userId),
  ]);
  const slotsLeftToday = Math.max(
    0,
    DAILY_SESSION_TARGET - (gradedTodayCount ?? 0)
  );
  const newSlotsLeft = Math.max(0, DAILY_NEW_TARGET - newIntrosToday);

  // /review is the word lane only: front/back recognition. Phrases live
  // in /review/typing as English cloze production drill — separating
  // the routes keeps the user's mental model clean.
  const [reviewRes, newRes] = await Promise.all([
    slotsLeftToday > 0
      ? supabase
          .from("cards")
          .select(CARD_COLUMNS)
          .eq("user_id", userId)
          .eq("card_type", "word")
          .in("status", ["learning", "review"])
          .lte("next_review_at", now)
          .order("next_review_at", { ascending: true })
          .limit(Math.min(REVIEW_FETCH_CAP, slotsLeftToday))
          .returns<Card[]>()
      : Promise.resolve({ data: [] as Card[] }),
    newSlotsLeft > 0 && slotsLeftToday > 0
      ? supabase
          .from("cards")
          .select(CARD_COLUMNS)
          .eq("user_id", userId)
          .eq("card_type", "word")
          .eq("status", "new")
          .lte("next_review_at", now)
          .order("next_review_at", { ascending: true })
          .limit(Math.min(newSlotsLeft, slotsLeftToday))
          .returns<Card[]>()
      : Promise.resolve({ data: [] as Card[] }),
  ]);

  const reviewCards = reviewRes.data ?? [];
  const reviewSlice = reviewCards.slice(0, slotsLeftToday);
  const remainingSlots = Math.max(0, slotsLeftToday - reviewSlice.length);
  const newCards = (newRes.data ?? []).slice(0, remainingSlots);
  const queue = [...reviewSlice, ...newCards];
  const totalDue = queue.length;

  if (queue.length === 0) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🎉</div>
        <p className="text-xl">今日の復習は完了しました</p>
        <Link
          href="/"
          className="h-11 px-6 rounded-2xl bg-accent text-accent-foreground flex items-center text-sm font-medium active:scale-95 transition"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  return <ReviewSession initialQueue={queue} totalDue={totalDue} />;
}
