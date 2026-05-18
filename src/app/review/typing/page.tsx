import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { TypingSession } from "./typing-session";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIMIT = 20;
// Words go through passive recognition first — they only earn the
// production drill once SRS has rotated them to a 14-day interval.
const WORD_MIN_INTERVAL = 14;
const CARD_COLUMNS =
  "id, user_id, card_type, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, user_note, audio_url, difficulty, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at";

export default async function TypingPage() {
  const supabase = createAdminClient();
  const userId = getUserId();

  // Phrases skip the interval gate: production-first is the design — knowing
  // a phrase passively in 14 days is too slow, the whole point of an
  // expression card is that it should come out of your mouth/keyboard now.
  const [wordRes, phraseRes] = await Promise.all([
    supabase
      .from("cards")
      .select(CARD_COLUMNS)
      .eq("user_id", userId)
      .eq("card_type", "word")
      .neq("status", "suspended")
      .gte("interval_days", WORD_MIN_INTERVAL)
      .limit(200)
      .returns<Card[]>(),
    supabase
      .from("cards")
      .select(CARD_COLUMNS)
      .eq("user_id", userId)
      .eq("card_type", "expression")
      .neq("status", "suspended")
      .limit(200)
      .returns<Card[]>(),
  ]);

  const pool = [...(wordRes.data ?? []), ...(phraseRes.data ?? [])];
  if (pool.length < 5) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🌱</div>
        <p className="text-xl">まだ英訳ドリルの対象がありません</p>
        <p className="text-xs text-muted text-center">
          単語はインターバル {WORD_MIN_INTERVAL}日以上、フレーズは通常の
          復習を一度通したものから挑戦できます。
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
