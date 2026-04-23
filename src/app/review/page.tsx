import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { ReviewSession } from "./review-session";
import type { Card } from "@/lib/types";
import { DAILY_NEW_TARGET, countNewIntrosSince } from "@/lib/goals";

export const dynamic = "force-dynamic";

// All overdue learning/review cards must be cleared to keep SRS healthy, so
// we cap generously to avoid runaway queues but don't aim to be restrictive.
const REVIEW_FETCH_CAP = 300;
const CARD_COLUMNS =
  "id, user_id, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, user_note, audio_url, difficulty, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at";

export default async function ReviewPage() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();

  // Only serve remaining new-card slots (up to DAILY_NEW_TARGET today). Shares
  // the canonical intro-count helper with the home page so both agree.
  const newIntrosToday = await countNewIntrosSince(userId);
  const newSlotsLeft = Math.max(0, DAILY_NEW_TARGET - newIntrosToday);

  // Due review/learning cards first, then a capped slice of new cards.
  const [reviewRes, newRes] = await Promise.all([
    supabase
      .from("cards")
      .select(CARD_COLUMNS)
      .eq("user_id", userId)
      .in("status", ["learning", "review"])
      .lte("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(REVIEW_FETCH_CAP)
      .returns<Card[]>(),
    newSlotsLeft > 0
      ? supabase
          .from("cards")
          .select(CARD_COLUMNS)
          .eq("user_id", userId)
          .eq("status", "new")
          .lte("next_review_at", now)
          .order("next_review_at", { ascending: true })
          .limit(newSlotsLeft)
          .returns<Card[]>()
      : Promise.resolve({ data: [] as Card[] }),
  ]);

  const reviewCards = reviewRes.data ?? [];
  const newCards = newRes.data ?? [];
  const queue = [...reviewCards, ...newCards];
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
