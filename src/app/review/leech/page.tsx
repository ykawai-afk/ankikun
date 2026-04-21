import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { getLeechCardIds } from "@/lib/leech";
import { ReviewSession } from "../review-session";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeechReviewPage() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const ids = await getLeechCardIds(userId);

  if (ids.length === 0) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <div className="text-6xl">🌱</div>
        <p className="text-xl">苦手カードはありません</p>
        <Link
          href="/"
          className="h-11 px-6 rounded-2xl bg-accent text-accent-foreground flex items-center text-sm font-medium active:scale-95 transition"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  const { data: cards } = await supabase
    .from("cards")
    .select(
      "id, user_id, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at"
    )
    .in("id", ids)
    .eq("user_id", userId)
    .returns<Card[]>();

  const queue = (cards ?? []).sort(
    (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
  );

  return <ReviewSession initialQueue={queue} totalDue={queue.length} />;
}
