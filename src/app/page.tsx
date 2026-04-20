import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ count: dueCount }, { count: totalCount }, { count: newCount }] =
    await Promise.all([
      supabase
        .from("cards")
        .select("*", { count: "exact", head: true })
        .neq("status", "suspended")
        .lte("next_review_at", now),
      supabase.from("cards").select("*", { count: "exact", head: true }),
      supabase
        .from("cards")
        .select("*", { count: "exact", head: true })
        .eq("status", "new"),
    ]);

  const due = dueCount ?? 0;
  const total = totalCount ?? 0;
  const newOnes = newCount ?? 0;

  return (
    <main className="flex flex-1 flex-col items-center p-8 gap-8 max-w-2xl mx-auto w-full">
      <header className="w-full flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Ankikun</h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
            ログアウト
          </button>
        </form>
      </header>

      <section className="w-full grid grid-cols-3 gap-3">
        <Stat label="Due" value={due} accent={due > 0} />
        <Stat label="New" value={newOnes} />
        <Stat label="Total" value={total} />
      </section>

      <section className="w-full flex flex-col gap-3">
        {due > 0 ? (
          <Link
            href="/review"
            className="h-14 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center font-medium text-lg hover:opacity-90 transition"
          >
            復習を始める ({due})
          </Link>
        ) : (
          <div className="h-14 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500">
            今日の復習は完了
          </div>
        )}
        <Link
          href="/cards"
          className="h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
        >
          すべてのカード
        </Link>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-1 ${
        accent
          ? "border-zinc-900 dark:border-white"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
