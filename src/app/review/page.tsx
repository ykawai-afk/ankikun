import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { ReviewSession } from "./review-session";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 30;

export default async function ReviewPage() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();

  const [{ data: cards }, { count }] = await Promise.all([
    supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lte("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(BATCH_SIZE)
      .returns<Card[]>(),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lte("next_review_at", now),
  ]);

  const queue = cards ?? [];
  const totalDue = count ?? queue.length;

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
