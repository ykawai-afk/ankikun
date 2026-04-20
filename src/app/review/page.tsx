import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { ReviewCard } from "./review-card";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();

  const [{ data: card }, { count }] = await Promise.all([
    supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lte("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(1)
      .maybeSingle<Card>(),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lte("next_review_at", now),
  ]);

  if (!card) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-6 p-8">
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

  const totalDue = count ?? 1;
  return <ReviewCard card={card} remaining={totalDue} totalDue={totalDue} />;
}
