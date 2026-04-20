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
      <div className="py-4 flex flex-col gap-5">
        {/* Streak + daily progress */}
        <section className="flex items-center gap-2">
          <StreakBadge days={streak} />
          <div className="flex-1 rounded-xl bg-surface-2 p-2.5 flex items-center gap-2.5">
            <ProgressRing value={todayCount} max={DAILY_GOAL} size={40} stroke={4}>
              <span className="text-[10px] font-semibold tabular-nums">
                {todayCount}
              </span>
            </ProgressRing>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-muted flex items-center gap-1">
                <Target size={9} /> Daily goal
              </span>
              <span className="text-xs font-medium">
                {todayCount} / {DAILY_GOAL}
              </span>
              {todayCount >= DAILY_GOAL && (
                <span className="text-[10px] text-success font-medium">
                  達成！
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Hero */}
        <section className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted uppercase tracking-widest">
            <Zap size={10} className="text-accent" /> Today
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[56px] font-semibold tabular-nums tracking-tight leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              {due}
            </span>
            <span className="text-sm text-muted">cards due</span>
          </div>
        </section>

        {/* Primary CTA */}
        {due > 0 ? (
          <Link
            href="/review"
            className="group h-12 rounded-2xl bg-accent text-accent-foreground flex items-center justify-between px-4 active:scale-[0.98] transition shadow-[0_8px_24px_-10px_var(--accent)]"
          >
            <span className="text-sm font-semibold tracking-tight">
              復習を始める
            </span>
            <span className="w-8 h-8 rounded-full bg-accent-foreground/15 flex items-center justify-center group-hover:translate-x-0.5 transition">
              <ArrowRight size={14} />
            </span>
          </Link>
        ) : (
          <div className="h-12 rounded-2xl bg-success-soft border border-success/20 flex items-center justify-center text-success text-sm font-medium">
            🎉 今日の復習は完了
          </div>
        )}

        {/* Mastered */}
        <section className="rounded-xl bg-success-soft p-3 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-success/80 font-semibold">
                Mastered
              </span>
              <span className="text-[10px] text-muted">
                {MASTERED_THRESHOLD_DAYS}日以上の間隔で復習できるカード
              </span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-semibold tabular-nums text-success">
                {mastered}
              </span>
              <span className="text-xs text-muted">/ {total}</span>
            </div>
          </div>
          <div className="h-1 rounded-full bg-success/15 overflow-hidden">
            <div
              style={{ width: `${masteredPct}%` }}
              className="h-full bg-success transition-[width] duration-500 ease-out"
            />
          </div>
          {masteredPct > 0 && (
            <span className="text-[10px] text-success/80 font-medium tabular-nums self-end">
              {masteredPct}%
            </span>
          )}
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-3 gap-2">
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
      className={`flex items-center gap-1 rounded-full px-2.5 h-10 ${
        active
          ? "bg-gradient-to-br from-[#fbbf24] to-[#f97316] text-white shadow-[0_4px_12px_-4px_#f97316]"
          : "bg-surface-2 text-muted"
      }`}
    >
      <Flame
        size={14}
        fill={active ? "currentColor" : "none"}
        strokeWidth={active ? 1.8 : 2}
      />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold tabular-nums">{days}</span>
        <span className="text-[8px] uppercase tracking-widest opacity-90">
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
    <div className={`rounded-xl p-2.5 flex flex-col gap-0.5 ${bg}`}>
      <div className="text-[9px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
