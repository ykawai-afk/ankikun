import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { TypingSession } from "./typing-session";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIMIT = 20;
const CARD_COLUMNS =
  "id, user_id, card_type, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, user_note, audio_url, difficulty, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at";

export default async function TypingPage() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();

  // Typing drill semantics (post-2026-05-18 reset):
  // - Honour SRS `next_review_at`: never re-surface a card the user
  //   already cleared today. Without this filter the same word showed
  //   up multiple times per session.
  // - No interval gate for words. The previous 14-day passive-first
  //   rule was throttling production access on a 4k-card year-end push.
  //   New / learning / review status all flow through; SRS still
  //   schedules the cadence.
  // - Expressions stay chat-organic only — bulk curriculum phrases live
  //   outside the daily drill.
  const [wordRes, phraseRes] = await Promise.all([
    supabase
      .from("cards")
      .select(CARD_COLUMNS)
      .eq("user_id", userId)
      .eq("card_type", "word")
      .neq("status", "suspended")
      .lte("next_review_at", now)
      .limit(200)
      .returns<Card[]>(),
    supabase
      .from("cards")
      .select(CARD_COLUMNS)
      .eq("user_id", userId)
      .eq("card_type", "expression")
      .eq("curriculum_source", "chat-organic")
      .neq("status", "suspended")
      .lte("next_review_at", now)
      .limit(200)
      .returns<Card[]>(),
  ]);

  const pool = [...(wordRes.data ?? []), ...(phraseRes.data ?? [])];
  if (pool.length === 0) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🎉</div>
        <p className="text-xl">今日のドリル完了</p>
        <p className="text-xs text-muted text-center">
          今すぐ復習が必要なカードはありません。
          <br />
          ホームの「今日のノルマ」から新規導入もできます。
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

  const shuffled = pool
    .map((c) => ({ c, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((p) => p.c)
    .slice(0, LIMIT);

  return <TypingSession initialQueue={shuffled} />;
}
