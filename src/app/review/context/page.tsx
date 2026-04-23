import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { ReviewSession } from "../review-session";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

// Cards that are past the intro-learning spike (interval ≥ 2d) but not yet
// mastered (≤ 20d). This is the consolidation window where cloze/context
// recall adds the most value — the word is no longer fresh but not yet
// autopilot. Capped at 40 per session.
const FETCH_CAP = 40;
const MIN_INTERVAL = 2;
const MAX_INTERVAL = 20;
const CARD_COLUMNS =
  "id, user_id, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, user_note, audio_url, difficulty, frequency_rank, was_intro_easy, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at";

export default async function ContextReviewPage() {
  const supabase = createAdminClient();
  const userId = getUserId();

  const { data: cards } = await supabase
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "suspended")
    .not("example_en", "is", null)
    .gte("interval_days", MIN_INTERVAL)
    .lte("interval_days", MAX_INTERVAL)
    .order("interval_days", { ascending: true })
    .limit(FETCH_CAP)
    .returns<Card[]>();

  const queue = cards ?? [];

  if (queue.length === 0) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">📖</div>
        <p className="text-xl">文脈復習の対象がまだありません</p>
        <p className="text-xs text-muted text-center max-w-xs">
          間隔 {MIN_INTERVAL}〜{MAX_INTERVAL}日の定着中カードが貯まると、
          ここで文中の空欄を埋めて思い出すモードが開きます。
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

  return <ReviewSession initialQueue={queue} totalDue={queue.length} forceCloze />;
}
