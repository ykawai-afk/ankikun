import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { ReviewSession } from "../../review-session";
import type { Card } from "@/lib/types";
import { canonicalSegment, type RootCard } from "@/lib/root-groups";
import { groupCardsByRoot } from "@/lib/root-groups";

export const dynamic = "force-dynamic";

const CARD_COLUMNS =
  "id, user_id, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, source_image_path, source_context, etymology, user_note, audio_url, difficulty, frequency_rank, was_intro_easy, image_url, related_words, extra_examples, deep_dive, tags, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, status, created_at, updated_at";

export default async function RootReviewSessionPage({
  params,
}: {
  params: Promise<{ root: string }>;
}) {
  const { root } = await params;
  const target = canonicalSegment(decodeURIComponent(root));
  const supabase = createAdminClient();
  const userId = getUserId();

  // Fetch all candidate cards (deep_dive populated, non-suspended). We
  // could narrow with a JSONB query but the card volume is small enough
  // that grouping in JS via the shared helper keeps the logic identical
  // to the list page.
  const { data: cards } = await supabase
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "suspended")
    .not("deep_dive", "is", null)
    .returns<Card[]>();

  const groups = groupCardsByRoot((cards ?? []) as unknown as RootCard[]);
  const hit = groups.find((g) => g.segment === target);

  if (!hit || !cards) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8 pb-24">
        <p className="text-xl">この語根のカードが見つかりません</p>
        <Link
          href="/review/root"
          className="h-11 px-6 rounded-2xl bg-accent text-accent-foreground flex items-center text-sm font-medium active:scale-95 transition"
        >
          語根一覧へ戻る
        </Link>
      </main>
    );
  }

  const ids = new Set(hit.cards.map((c) => c.id));
  const queue = cards
    .filter((c) => ids.has(c.id))
    .sort((a, b) => a.interval_days - b.interval_days);

  return <ReviewSession initialQueue={queue} totalDue={queue.length} />;
}
