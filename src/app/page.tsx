import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Flame,
  Keyboard,
  Snowflake,
  Sparkles,
  Sprout,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { PageShell } from "@/components/page-shell";
import { Heatmap } from "@/components/heatmap";
import { computeStreak, reviewedTodayCount, countsByDay } from "@/lib/streak";
import { getLeechCount } from "@/lib/leech";
import { DAILY_NEW_TARGET, countNewIntrosSince } from "@/lib/goals";
import { MASTERED_THRESHOLD_DAYS } from "@/lib/mastery";
import { loadUserStateWithRefill, loadFrozenDays } from "@/lib/streak-freeze";
import { FreezeStreakButton } from "@/components/freeze-streak-button";

export const dynamic = "force-dynamic";
const TYPING_MIN_INTERVAL = 14;
const TYPING_MIN_COUNT = 5;
// Context review surfaces when there are enough consolidation-phase cards
// (interval 2-20d) — matches the fetch range in /review/context.
const CONTEXT_MIN_INTERVAL = 2;
const CONTEXT_MAX_INTERVAL = 20;
const CONTEXT_MIN_COUNT = 5;
// Root review surfaces once ≥10 cards have deep_dive data populated — the
// actual group-count threshold (≥2 cards per root) is enforced on the
// /review/root page so we don't need to compute groups on every home load.
const ROOT_MIN_DEEP_DIVE = 10;

export default async function Home() {
  const supabase = createAdminClient();
  const userId = getUserId();
  const now = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 100 * 86_400_000).toISOString();

  const next24hIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const [
    reviewDueRes,
    newAvailRes,
    totalRes,
    activeRes,
    masteredRes,
    logsRes,
    newIntrosToday,
    leechCount,
    typingPoolRes,
    contextPoolRes,
    rootPoolRes,
    tomorrowAddsRes,
    userState,
    frozenDays,
  ] = await Promise.all([
    // Cards that have been touched at least once AND are due
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["learning", "review"])
      .lte("next_review_at", now),
    // New cards not yet introduced
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "new")
      .lte("next_review_at", now),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    // Active denominator (non-suspended). Mastered % compares mastered against
    // what the user is actually still studying, not against lifetime cards.
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended"),
    // Mastered = interval ≥ 21d OR was_intro_easy. Matches isMastered()
    // in src/lib/mastery.ts so the count here aligns with stats.
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .or(`interval_days.gte.${MASTERED_THRESHOLD_DAYS},was_intro_easy.eq.true`),
    supabase
      .from("review_logs")
      .select("reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", ninetyDaysAgo)
      .order("reviewed_at", { ascending: false }),
    countNewIntrosSince(userId),
    getLeechCount(userId),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .gte("interval_days", TYPING_MIN_INTERVAL),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .not("example_en", "is", null)
      .gte("interval_days", CONTEXT_MIN_INTERVAL)
      .lte("interval_days", CONTEXT_MAX_INTERVAL),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "suspended")
      .not("deep_dive", "is", null),
    // Cards that aren't overdue yet but will be within 24h. Loss-framed
    // widget on home nudges "yesterday it was N, today it'll be N+M" —
    // the delta is what gets added to the queue if today is skipped.
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["learning", "review"])
      .gt("next_review_at", now)
      .lte("next_review_at", next24hIso),
    loadUserStateWithRefill(userId),
    loadFrozenDays(userId),
  ]);

  const reviewDue = reviewDueRes.count ?? 0;
  const newAvailable = newAvailRes.count ?? 0;
  const typingPool = typingPoolRes.count ?? 0;
  const contextPool = contextPoolRes.count ?? 0;
  const rootPool = rootPoolRes.count ?? 0;
  const total = totalRes.count ?? 0;
  const active = activeRes.count ?? 0;
  const mastered = masteredRes.count ?? 0;
  const masteredPct = active > 0 ? Math.round((mastered / active) * 100) : 0;
  const reviewedAts = (logsRes.data ?? []).map((r) => r.reviewed_at as string);
  const streak = computeStreak(reviewedAts, frozenDays);
  const todayCount = reviewedTodayCount(reviewedAts);
  const heatmap = countsByDay(reviewedAts);
  const tomorrowAdds = tomorrowAddsRes.count ?? 0;

  // Streak freeze UX: offer redeeming a freeze for yesterday only if the
  // user has unbroken streak continuity up to the day before yesterday
  // (i.e., one-day gap). Multiple-day gaps aren't rescuable with one
  // freeze anyway.
  const tz = "Asia/Tokyo";
  const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const todayYmd = ymd(new Date());
  const yesterdayYmd = ymd(new Date(Date.now() - 86_400_000));
  const reviewedOrFrozenDaySet = new Set<string>([
    ...reviewedAts.map((iso) => ymd(new Date(iso))),
    ...frozenDays,
  ]);
  const yesterdayMissed = !reviewedOrFrozenDaySet.has(yesterdayYmd);
  const dayBeforeYesterdayYmd = ymd(new Date(Date.now() - 2 * 86_400_000));
  const offerFreeze =
    yesterdayMissed &&
    reviewedOrFrozenDaySet.has(dayBeforeYesterdayYmd) &&
    userState.streak_freezes_available > 0 &&
    !reviewedOrFrozenDaySet.has(todayYmd);

  const newRemainingToday = Math.max(
    0,
    Math.min(DAILY_NEW_TARGET - newIntrosToday, newAvailable)
  );
  const newPct = Math.min(
    100,
    Math.round((newIntrosToday / DAILY_NEW_TARGET) * 100)
  );
  const todayDone = newIntrosToday >= DAILY_NEW_TARGET && reviewDue === 0;

  return (
    <PageShell>
      <div className="py-4 flex flex-col gap-5">
        {/* Streak */}
        <section className="flex items-center gap-2">
          <StreakBadge days={streak} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-widest text-muted">
              Today · 完了 {todayCount}
            </span>
            <span className="text-[10px] text-muted inline-flex items-center gap-1">
              <Snowflake
                size={10}
                className={
                  userState.streak_freezes_available > 0
                    ? "text-sky-500"
                    : "text-muted/40"
                }
              />
              凍結ストック {userState.streak_freezes_available}
            </span>
          </div>
        </section>

        {offerFreeze && (
          <FreezeStreakButton day={yesterdayYmd} />
        )}

        {/* Today panel: new quota + due review */}
        <section className="flex flex-col gap-2.5">
          <Link
            href="/review"
            className="group rounded-2xl bg-surface border border-border p-4 flex flex-col gap-3 active:scale-[0.995] transition hover:border-accent/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted font-semibold">
                今日やるべき
              </span>
              {todayDone && (
                <span className="text-[10px] font-semibold text-success inline-flex items-center gap-0.5">
                  🎉 完了
                </span>
              )}
            </div>

            {/* 新規 quota */}
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                  <Sparkles size={11} className="text-accent" />
                  新規
                </span>
                <span className="text-[11px] tabular-nums">
                  <span className="font-semibold">{newIntrosToday}</span>
                  <span className="text-muted"> / {DAILY_NEW_TARGET}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                <div
                  style={{ width: `${newPct}%` }}
                  className="h-full bg-accent transition-[width] duration-500 ease-out"
                />
              </div>
              <span className="text-[10px] text-muted">
                {newRemainingToday > 0
                  ? `残り${newRemainingToday}枚`
                  : newIntrosToday >= DAILY_NEW_TARGET
                    ? "今日分の新規は達成"
                    : "新規カードなし"}
              </span>
            </div>

            {/* 復習 (variable) */}
            <div className="flex items-center justify-between pt-1 border-t border-border/60">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                <Flame size={11} className="text-flame" />
                復習
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold tabular-nums">
                  {reviewDue}
                </span>
                <span className="text-[10px] text-muted">枚</span>
                <ArrowRight
                  size={12}
                  className="ml-1 text-muted group-hover:translate-x-0.5 group-hover:text-accent transition"
                />
              </div>
            </div>
            {/* Forgetting meter: loss-framed preview of tomorrow's load
                if today is skipped. Only shown when there's something
                to lose — silent when no cards due soon. */}
            {tomorrowAdds > 0 && (
              <div className="text-[10px] text-muted leading-relaxed">
                今日サボると明日{" "}
                <span className="font-semibold text-flame tabular-nums">
                  +{tomorrowAdds}枚
                </span>{" "}
                が期限切れに
              </div>
            )}
          </Link>
        </section>

        {todayDone && (
          <div className="h-10 rounded-xl bg-success-soft border border-success/20 flex items-center justify-center text-success text-xs font-medium">
            🎉 今日のノルマ完了 — また明日
          </div>
        )}

        {leechCount > 0 && (
          <Link
            href="/review/leech"
            className="group rounded-xl bg-amber-500/5 border border-amber-500/25 px-3.5 py-2.5 flex items-center gap-2 active:scale-[0.99] transition"
          >
            <AlertTriangle
              size={14}
              className="text-amber-600 dark:text-amber-400 shrink-0"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-widest text-amber-700 dark:text-amber-400 font-semibold">
                苦手カード
              </span>
              <span className="text-[12px]">
                <span className="font-semibold tabular-nums">{leechCount}</span>
                <span className="text-muted"> 枚が集中攻撃待ち</span>
              </span>
            </div>
            <ArrowRight
              size={13}
              className="text-amber-600/70 dark:text-amber-400/70 group-hover:translate-x-0.5 transition"
            />
          </Link>
        )}

        {typingPool >= TYPING_MIN_COUNT && (
          <Link
            href="/review/typing"
            className="group rounded-xl bg-accent-soft border border-accent/20 px-3.5 py-2.5 flex items-center gap-2 active:scale-[0.99] transition"
          >
            <Keyboard size={14} className="text-accent shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-widest text-accent font-semibold">
                英訳ドリル
              </span>
              <span className="text-[12px]">
                <span className="font-semibold tabular-nums">{typingPool}</span>
                <span className="text-muted"> 枚から定着テスト</span>
              </span>
            </div>
            <ArrowRight
              size={13}
              className="text-accent/70 group-hover:translate-x-0.5 transition"
            />
          </Link>
        )}

        {contextPool >= CONTEXT_MIN_COUNT && (
          <Link
            href="/review/context"
            className="group rounded-xl bg-emerald-500/5 border border-emerald-500/25 px-3.5 py-2.5 flex items-center gap-2 active:scale-[0.99] transition"
          >
            <BookOpen
              size={14}
              className="text-emerald-600 dark:text-emerald-400 shrink-0"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-semibold">
                文脈から復習
              </span>
              <span className="text-[12px]">
                <span className="font-semibold tabular-nums">{contextPool}</span>
                <span className="text-muted"> 枚を空欄で思い出す</span>
              </span>
            </div>
            <ArrowRight
              size={13}
              className="text-emerald-600/70 dark:text-emerald-400/70 group-hover:translate-x-0.5 transition"
            />
          </Link>
        )}

        {rootPool >= ROOT_MIN_DEEP_DIVE && (
          <Link
            href="/review/root"
            className="group rounded-xl bg-violet-500/5 border border-violet-500/25 px-3.5 py-2.5 flex items-center gap-2 active:scale-[0.99] transition"
          >
            <Sprout
              size={14}
              className="text-violet-600 dark:text-violet-400 shrink-0"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-widest text-violet-700 dark:text-violet-400 font-semibold">
                語根で復習
              </span>
              <span className="text-[12px]">
                <span className="font-semibold tabular-nums">{rootPool}</span>
                <span className="text-muted"> 枚から語根グループ</span>
              </span>
            </div>
            <ArrowRight
              size={13}
              className="text-violet-600/70 dark:text-violet-400/70 group-hover:translate-x-0.5 transition"
            />
          </Link>
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
              <span className="text-xs text-muted">/ {active}</span>
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

        {/* Totals */}
        <section className="grid grid-cols-2 gap-2">
          <Stat label="Total" value={total} />
          <Stat label="24h 完了" value={todayCount} tone="flame" />
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
