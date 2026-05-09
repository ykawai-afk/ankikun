import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { ExpressionSession } from "./expression-session";
import type { Card } from "@/lib/types";
import { DAILY_EXPRESSION_TARGET, jstStartOfDay } from "@/lib/goals";

export const dynamic = "force-dynamic";

const EXPRESSION_COLUMNS =
  "id, user_id, card_type, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, user_note, audio_url, difficulty, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at";

export default async function ExpressionReviewPage() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();
  const dayStart = jstStartOfDay().toISOString();

  // Today's expression grades count against the nightly cap. We fetch the
  // user's expression card IDs first so the review_logs count can scope to
  // this lane (review_logs has no card_type column).
  const { data: expressionIdRows } = await supabase
    .from("cards")
    .select("id")
    .eq("user_id", userId)
    .eq("card_type", "expression");
  const expressionIds = (expressionIdRows ?? []).map((r) => r.id);

  let gradedExprToday = 0;
  if (expressionIds.length > 0) {
    const { count } = await supabase
      .from("review_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("reviewed_at", dayStart)
      .in("card_id", expressionIds);
    gradedExprToday = count ?? 0;
  }
  const slotsLeftToday = Math.max(
    0,
    DAILY_EXPRESSION_TARGET - gradedExprToday
  );

  if (expressionIds.length === 0) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🌙</div>
        <p className="text-xl">表現カードがまだありません</p>
        <p className="text-xs text-muted text-center max-w-xs leading-relaxed">
          /add の CSV から「表現（夜の練習）」モードでまとめて投入できる。
          夜のChatGPT音声ロールプレイ用のレーン。
        </p>
        <div className="flex gap-2">
          <Link
            href="/add"
            className="h-11 px-6 rounded-2xl bg-accent text-accent-foreground flex items-center text-sm font-medium active:scale-95 transition"
          >
            CSVを投入
          </Link>
          <Link
            href="/"
            className="h-11 px-6 rounded-2xl bg-surface-2 flex items-center text-sm font-medium active:scale-95 transition"
          >
            ホーム
          </Link>
        </div>
      </main>
    );
  }

  if (slotsLeftToday === 0) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🎉</div>
        <p className="text-xl">今夜の練習は完了</p>
        <p className="text-xs text-muted text-center">
          {DAILY_EXPRESSION_TARGET}枚 × ChatGPT音声ロールプレイ完了。お疲れさま。
        </p>
        <Link
          href="/"
          className="h-11 px-6 rounded-2xl bg-accent text-accent-foreground flex items-center text-sm font-medium active:scale-95 transition"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  // Same priority as the word lane: overdue learning/review first, fill
  // remaining slots with new cards. Ordered by due time so oldest expiry
  // wins.
  const [reviewRes, newRes] = await Promise.all([
    supabase
      .from("cards")
      .select(EXPRESSION_COLUMNS)
      .eq("user_id", userId)
      .eq("card_type", "expression")
      .in("status", ["learning", "review"])
      .lte("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(slotsLeftToday)
      .returns<Card[]>(),
    supabase
      .from("cards")
      .select(EXPRESSION_COLUMNS)
      .eq("user_id", userId)
      .eq("card_type", "expression")
      .eq("status", "new")
      .lte("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(slotsLeftToday)
      .returns<Card[]>(),
  ]);

  const reviewCards = reviewRes.data ?? [];
  const reviewSlice = reviewCards.slice(0, slotsLeftToday);
  const remainingSlots = Math.max(0, slotsLeftToday - reviewSlice.length);
  const newCards = (newRes.data ?? []).slice(0, remainingSlots);
  const queue = [...reviewSlice, ...newCards];

  if (queue.length === 0) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🌙</div>
        <p className="text-xl">期限の来た表現はありません</p>
        <p className="text-xs text-muted text-center max-w-xs">
          まだ復習タイミングが来ていない。明日以降のキューを待とう。
        </p>
        <Link
          href="/"
          className="h-11 px-6 rounded-2xl bg-accent text-accent-foreground flex items-center text-sm font-medium active:scale-95 transition"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  return (
    <ExpressionSession
      initialQueue={queue}
      totalDue={queue.length}
      gradedTodayBefore={gradedExprToday}
    />
  );
}
