import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { PageShell } from "@/components/page-shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [
    { count: dueCount },
    { count: totalCount },
    { count: newCount },
    { count: reviewed24h },
  ] = await Promise.all([
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .lte("next_review_at", now),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "new"),
    supabase
      .from("review_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("reviewed_at", dayAgo),
  ]);

  const due = dueCount ?? 0;
  const total = totalCount ?? 0;
  const fresh = newCount ?? 0;
  const recent = reviewed24h ?? 0;

  return (
    <PageShell>
      <div className="py-8 flex flex-col gap-8">
        {/* Hero */}
        <section className="flex flex-col items-start gap-2 pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted uppercase tracking-widest">
            <Sparkles size={12} /> Today
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-7xl font-semibold tabular-nums tracking-tight leading-none">
              {due}
            </span>
            <span className="text-lg text-muted">cards due</span>
          </div>
        </section>

        {/* Primary CTA */}
        {due > 0 ? (
          <Link
            href="/review"
            className="group h-16 rounded-3xl bg-accent text-accent-foreground flex items-center justify-between px-6 active:scale-[0.98] transition shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]"
          >
            <span className="text-lg font-medium">復習を始める</span>
            <span className="w-9 h-9 rounded-full bg-accent-foreground/10 flex items-center justify-center group-hover:translate-x-0.5 transition">
              <ArrowRight size={18} />
            </span>
          </Link>
        ) : (
          <div className="h-16 rounded-3xl border border-border flex items-center justify-center text-muted">
            🎉 今日の復習は完了
          </div>
        )}

        {/* Stats grid */}
        <section className="grid grid-cols-3 gap-3">
          <Stat label="New" value={fresh} />
          <Stat label="Total" value={total} />
          <Stat label="24h" value={recent} />
        </section>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4 flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
