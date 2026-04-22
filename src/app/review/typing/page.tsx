import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { TypingSession } from "./typing-session";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIMIT = 20;
const MIN_INTERVAL = 14;

export default async function TypingPage() {
  const supabase = createAdminClient();
  const userId = getUserId();

  const { data: cards } = await supabase
    .from("cards")
    .select(
      "id, user_id, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, user_note, audio_url, difficulty, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at"
    )
    .eq("user_id", userId)
    .neq("status", "suspended")
    .gte("interval_days", MIN_INTERVAL)
    .limit(200)
    .returns<Card[]>();

  const pool = cards ?? [];
  if (pool.length < 5) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🌱</div>
        <p className="text-xl">まだ英訳ドリルの対象がありません</p>
        <p className="text-xs text-muted text-center">
          インターバル {MIN_INTERVAL}日以上のカードが5枚以上たまると挑戦できます。
          <br />
          通常の復習で「定着した」カードを増やしましょう。
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
