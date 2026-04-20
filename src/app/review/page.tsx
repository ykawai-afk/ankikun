import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewCard } from "./review-card";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: card } = await supabase
    .from("cards")
    .select("*")
    .neq("status", "suspended")
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true })
    .limit(1)
    .maybeSingle<Card>();

  const { count } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .neq("status", "suspended")
    .lte("next_review_at", now);

  if (!card) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <p className="text-xl">今日の復習は完了しました</p>
        <Link
          href="/"
          className="h-11 px-6 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  return <ReviewCard card={card} remaining={count ?? 1} />;
}
