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

  // /review/typing is the **phrase-only** English cloze drill. Words
  // live in /review (front/back recognition). Restrict to chat-organic
  // expressions — bulk curriculum phrases sit outside the daily flow.
  const { data: phraseCards } = await supabase
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("user_id", userId)
    .eq("card_type", "expression")
    .eq("curriculum_source", "chat-organic")
    .neq("status", "suspended")
    .lte("next_review_at", now)
    .limit(200)
    .returns<Card[]>();

  const pool = phraseCards ?? [];
  if (pool.length === 0) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🎉</div>
        <p className="text-xl">フレーズ穴埋め完了</p>
        <p className="text-xs text-muted text-center">
          今すぐ復習が必要な Claude Code フレーズはありません。
          <br />
          チャットで新しいフレーズが採用されると次回ここに並びます。
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
