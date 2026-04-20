import Link from "next/link";
import { ArrowRight, Flame, Target, Zap } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { PageShell } from "@/components/page-shell";
import { ProgressRing } from "@/components/progress-ring";
import { Heatmap } from "@/components/heatmap";
import { computeStreak, reviewedTodayCount, countsByDay } from "@/lib/streak";

export const dynamic = "force-dynamic";

const DAILY_GOAL = 20;
const MASTERED_THRESHOLD_DAYS = 21;

export default async function Home() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 100 * 86_400_000).toISOString();

  const [dueRes, totalRes, newRes, masteredRes, logsRes] = await Promise.all([
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
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("interval_days", MASTERED_THRESHOLD_DAYS),
    supabase
      .from("review_logs")
      .select("reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", ninetyDaysAgo)
      .order("reviewed_at", { ascending: false }),
  ]);

  const due = dueRes.count ?? 0;
  const total = totalRes.count ?? 0;
  const fresh = newRes.count ?? 0;
  const mastered = masteredRes.count ?? 0;
  const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const reviewedAts = (logsRes.data ?? []).map((r) => r.reviewed_at as string);
  const streak = computeStreak(reviewedAts);
  const todayCount = reviewedTodayCount(reviewedAts);
  const heatmap = countsByDay(reviewedAts);

  return (
    <PageShell>
      <div className="py-6 flex flex-col gap-7">
        {/* Streak + daily progress */}
        <section className="flex items-center gap-3">
          <StreakBadge days={streak} />
          <div className="flex-1 rounded-2xl bg-surface-2 p-3 flex items-center gap-3">
            <ProgressRing value={todayCount} max={DAILY_GOAL} size={52} stroke={5}>
              <span className="text-[11px] font-semibold tabular-nums">
                {todayCount}
              </span>
            </ProgressRing>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-muted flex items-center gap-1">
                <Target size={10} /> Daily goal
              </span>
              <span className="text-sm font-medium">
                {todayCount} / {DAILY_GOAL}
              </span>
              {todayCount >= DAILY_GOAL && (
                <span className="text-[11px] text-success font-medium">
                  達成！
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Hero */}
        <section className="flex flex-col items-start gap-1 pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted uppercase tracking-widest">
            <Zap size={12} className="text-accent" /> Today
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-[88px] font-semibold tabular-nums tracking-tight leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              {due}
            </span>
            <span className="text-lg text-muted">cards due</span>
          </div>
        </section>

        {/* Primary CTA */}
        {due > 0 ? (
          <Link
            href="/review"
            className="group h-16 rounded-3xl bg-accent text-accent-foreground flex items-center justify-between px-6 active:scale-[0.98] transition shadow-[0_10px_30px_-10px_var(--accent)]"
          >
            <span className="text-lg font-semibold tracking-tight">
              復習を始める
            </span>
            <span className="w-10 h-10 rounded-full bg-accent-foreground/15 flex items-center justify-center group-hover:translate-x-0.5 transition">
              <ArrowRight size={18} />
            </span>
          </Link>
        ) : (
          <div className="h-16 rounded-3xl bg-success-soft border border-success/20 flex items-center justify-center text-success font-medium">
            🎉 今日の復習は完了
          </div>
        )}

        {/* Mastered progress */}
        <section className="rounded-2xl bg-success-soft p-4 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-widest text-success/80 font-semibold">
                Mastered
              </span>
              <span className="text-xs text-muted">
                {MASTERED_THRESHOLD_DAYS}日以上の間隔で復習できるカード
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tabular-nums text-success">
                {mastered}
              </span>
              <span className="text-sm text-muted">/ {total}</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-success/15 overflow-hidden">
            <div
              style={{ width: `${masteredPct}%` }}
              className="h-full bg-success transition-[width] duration-500 ease-out"
            />
          </div>
          {masteredPct > 0 && (
            <span className="text-[11px] text-success/80 font-medium tabular-nums self-end">
              {masteredPct}%
            </span>
          )}
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-3 gap-3">
          <Stat label="New" value={fresh} tone="accent" />
          <Stat label="Total" value={total} />
          <Stat label="24h" value={todayCount} tone="flame" />
        </section>

        {/* Activity heatmap */}
        <Heatmap countsByDay={heatmap} />
      </div>
    </PageShell>
  );
}

function StreakBadge({ days }: { days: number }) {
  const active = days > 0;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 h-12 ${
        active
          ? "bg-gradient-to-br from-[#fbbf24] to-[#f97316] text-white shadow-[0_6px_16px_-6px_#f97316]"
          : "bg-surface-2 text-muted"
      }`}
    >
      <Flame
        size={18}
        fill={active ? "currentColor" : "none"}
        strokeWidth={active ? 1.8 : 2}
      />
      <div className="flex flex-col leading-none">
        <span className="text-lg font-semibold tabular-nums">{days}</span>
        <span className="text-[9px] uppercase tracking-widest opacity-90">
          streak
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "accent" | "flame";
}) {
  const bg =
    tone === "accent"
      ? "bg-accent-soft"
      : tone === "flame"
        ? "bg-flame-soft"
        : "bg-surface-2";
  const valueColor =
    tone === "accent"
      ? "text-accent"
      : tone === "flame"
        ? "text-flame"
        : "text-foreground";
  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-1 ${bg}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
