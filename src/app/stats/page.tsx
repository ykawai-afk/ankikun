import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { CACHE_TAGS } from "@/lib/cache";
import { PageShell } from "@/components/page-shell";
import { LevelAvatar } from "@/components/level-avatar";
import {
  computeStreak,
  computeStudyMinutes,
  todayReviewedAts,
} from "@/lib/streak";
import {
  DAILY_NEW_TARGET,
  WEEKLY_NEW_TARGET,
  QUARTERLY_NEW_TARGET,
  YEARLY_NEW_TARGET,
  VOCAB_MILESTONES,
  vocabCurrentLevel,
  jstStartOfDay,
  jstStartOfWeek,
  jstStartOfQuarter,
  jstStartOfYear,
} from "@/lib/goals";
import { isMastered, isIntroLog } from "@/lib/mastery";
import { computeVocabEstimate } from "@/lib/vocab";

export const dynamic = "force-dynamic";

const MOMENTUM_DAYS = 30;
const RETENTION_WEEKS = 8;
const FORECAST_DAYS = 30;
// Session clustering: a gap >5min ends a session. Each review counts for at most
// 60s (cap avoids over-crediting pauses / phone-down time).
const SESSION_GAP_MS = 5 * 60_000;
const REVIEW_TIME_CAP_MS = 60_000;

const TZ = "Asia/Tokyo";
function ymdTokyo(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}
function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}
function hourTokyo(d: Date): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return Number(s) % 24;
}

type Grade = 0 | 1 | 2 | 3;

const GRADE_META: Record<
  Grade,
  { label: string; cls: string; dot: string }
> = {
  0: { label: "Again", cls: "bg-red-500", dot: "bg-red-500" },
  1: { label: "Hard", cls: "bg-amber-500", dot: "bg-amber-500" },
  2: { label: "Good", cls: "bg-emerald-500", dot: "bg-emerald-500" },
  3: { label: "Easy", cls: "bg-sky-500", dot: "bg-sky-500" },
};

// Server-cached bulk fetch: card snapshot + year-to-date logs + 100-day
// reviewed_at stream. Invalidated via revalidateTag(CACHE_TAGS.cards /
// .reviewLogs) whenever an action mutates either table.
const getStatsSnapshot = unstable_cache(
  async (userId: string, yearStartIso: string, ninetyAgoIso: string) => {
    const supabase = createAdminClient();
    const [totalRes, activeCardsRes, logsYearRes, logsStreakRes] =
      await Promise.all([
        supabase
          .from("cards")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("cards")
          .select(
            "id, interval_days, ease_factor, repetitions, difficulty, frequency_rank, was_intro_easy, next_review_at, status"
          )
          .eq("user_id", userId),
        supabase
          .from("review_logs")
          .select("card_id, rating, prev_interval, prev_ease, reviewed_at")
          .eq("user_id", userId)
          .gte("reviewed_at", yearStartIso)
          .order("reviewed_at", { ascending: true }),
        supabase
          .from("review_logs")
          .select("reviewed_at")
          .eq("user_id", userId)
          .gte("reviewed_at", ninetyAgoIso),
      ]);
    return {
      total: totalRes.count ?? 0,
      cards: activeCardsRes.data ?? [],
      yearLogs: logsYearRes.data ?? [],
      streakReviewedAts: (logsStreakRes.data ?? []).map(
        (r) => r.reviewed_at as string
      ),
    };
  },
  ["stats-snapshot"],
  { revalidate: 60, tags: [CACHE_TAGS.cards, CACHE_TAGS.reviewLogs] }
);

export default async function StatsPage() {
  const userId = getUserId();
  const now = new Date();
  const momentumFrom = new Date(
    now.getTime() - MOMENTUM_DAYS * 86_400_000
  ).toISOString();
  const retentionFrom = new Date(
    now.getTime() - RETENTION_WEEKS * 7 * 86_400_000
  ).toISOString();
  const ninetyAgo = new Date(
    now.getTime() - 100 * 86_400_000
  ).toISOString();

  const forecastUntil = shiftDays(now, FORECAST_DAYS + 1).toISOString();
  const goalDayStart = jstStartOfDay(now);
  const goalWeekStart = jstStartOfWeek(now);
  const goalQuarterStart = jstStartOfQuarter(now);
  const goalYearStart = jstStartOfYear(now);

  const snapshot = await getStatsSnapshot(
    userId,
    goalYearStart.toISOString(),
    ninetyAgo
  );
  const { total, cards, yearLogs, streakReviewedAts } = snapshot;
  const allCards = cards as {
    id: string;
    interval_days: number;
    ease_factor: number;
    repetitions: number;
    difficulty: string | null;
    frequency_rank: number | null;
    was_intro_easy: boolean;
    next_review_at: string;
    status: string;
  }[];
  // Derive subsets from the single cards fetch.
  const activeRaw = allCards.filter((c) => c.status !== "suspended");
  const mastered = activeRaw.filter(isMastered).length;
  const masteredPct =
    activeRaw.length > 0 ? Math.round((mastered / activeRaw.length) * 100) : 0;

  // Forecast window (30 days ahead).
  const forecastCutoffMs = new Date(forecastUntil).getTime();
  const forecastRaw = activeRaw.filter(
    (c) => new Date(c.next_review_at).getTime() <= forecastCutoffMs
  );

  // All year-to-date logs, bucketed into the four goal windows.
  const totalLogs = yearLogs.length; // "all time" == year for this display
  const dayStartMs = goalDayStart.getTime();
  const weekStartMs = goalWeekStart.getTime();
  const quarterStartMs = goalQuarterStart.getTime();
  let dayIntrosCount = 0,
    weekIntrosCount = 0,
    quarterIntrosCount = 0,
    yearIntrosCount = 0;
  for (const l of yearLogs) {
    if (!isIntroLog(l as { prev_interval: number | null; prev_ease: number | null })) continue;
    const t = new Date(l.reviewed_at as string).getTime();
    yearIntrosCount++;
    if (t >= quarterStartMs) quarterIntrosCount++;
    if (t >= weekStartMs) weekIntrosCount++;
    if (t >= dayStartMs) dayIntrosCount++;
  }

  // Logs within the 8-week retention window (for recentLogs consumers).
  const retentionMs = new Date(retentionFrom).getTime();
  const recentLogsData = yearLogs.filter(
    (l) => new Date(l.reviewed_at as string).getTime() >= retentionMs
  );
  const recentLogs = { data: recentLogsData };
  const forecastRes = { data: forecastRaw };
  const activeRes = { data: activeRaw };
  const streakLogs = { data: streakReviewedAts.map((r) => ({ reviewed_at: r })) };

  // Year-end projection: year-to-date avg × remaining days in year + current.
  const yearEnd = new Date(
    `${goalYearStart.getFullYear()}-12-31T23:59:59+09:00`
  );
  const daysIntoYear = Math.max(
    1,
    Math.floor((now.getTime() - goalYearStart.getTime()) / 86_400_000)
  );
  const daysLeftInYear = Math.max(
    0,
    Math.ceil((yearEnd.getTime() - now.getTime()) / 86_400_000)
  );
  const recentAvgPerDay = yearIntrosCount / daysIntoYear;
  const projectedYear = Math.round(
    yearIntrosCount + recentAvgPerDay * daysLeftInYear
  );
  const streak = computeStreak(
    (streakLogs.data ?? []).map((r) => r.reviewed_at as string)
  );
  const todayKey = ymdTokyo(now);
  const todayCount = (streakLogs.data ?? []).filter(
    (r) => ymdTokyo(new Date(r.reviewed_at as string)) === todayKey
  ).length;

  // === Momentum: per-day new intros + per-day rating breakdown (30d) ===
  const logs = (recentLogs.data ?? []).filter(
    (l) => new Date(l.reviewed_at as string).getTime() >= new Date(momentumFrom).getTime()
  );
  const dayIntros = new Map<string, number>();
  const dayGrades = new Map<string, Record<Grade, number>>();
  for (let i = MOMENTUM_DAYS - 1; i >= 0; i--) {
    const key = ymdTokyo(shiftDays(now, -i));
    dayIntros.set(key, 0);
    dayGrades.set(key, { 0: 0, 1: 0, 2: 0, 3: 0 });
  }
  for (const l of logs) {
    const key = ymdTokyo(new Date(l.reviewed_at as string));
    if (isIntroLog(l as { prev_interval: number | null; prev_ease: number | null })) {
      dayIntros.set(key, (dayIntros.get(key) ?? 0) + 1);
    }
    const g = dayGrades.get(key);
    if (g) g[l.rating as Grade] = (g[l.rating as Grade] ?? 0) + 1;
  }
  const momentumDays = [...dayIntros.keys()].sort();
  const intros = momentumDays.map((k) => dayIntros.get(k) ?? 0);
  const grades = momentumDays.map((k) => dayGrades.get(k)!);
  const maxIntro = Math.max(DAILY_NEW_TARGET, ...intros);
  const maxGradeTotal = Math.max(
    1,
    ...grades.map((g) => g[0] + g[1] + g[2] + g[3])
  );

  // === Interval distribution ===
  const active = (activeRes.data ?? []) as {
    id: string;
    interval_days: number;
    ease_factor: number;
    repetitions: number;
    difficulty: string | null;
    frequency_rank: number | null;
    was_intro_easy: boolean;
  }[];

  // === CEFR distribution + vocabulary estimate ===
  const cefrOrder = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
  type CEFRKey = (typeof cefrOrder)[number];
  const cefrCounts: Record<CEFRKey | "unknown", number> = {
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unknown: 0,
  };
  // Per-CEFR mastered counts for the vocab estimate. Uses the canonical
  // mastery definition from src/lib/mastery.ts so this number matches the
  // mastered counter on the home page.
  const masteredCefrCounts: Record<CEFRKey | "unknown", number> = {
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unknown: 0,
  };
  const cardDiffLookup = new Map<string, CEFRKey | "unknown">();

  for (const c of active) {
    const key = (
      c.difficulty && cefrOrder.includes(c.difficulty as CEFRKey)
        ? c.difficulty
        : "unknown"
    ) as CEFRKey | "unknown";
    cardDiffLookup.set(c.id, key);
    cefrCounts[key]++;
    if (isMastered(c)) masteredCefrCounts[key]++;
  }

  // Per-CEFR accuracy over the retention window (last 8 weeks). Used to
  // down-weight contributions from levels where the user is still shaky.
  const cefrReviewTotals: Record<string, number> = {};
  const cefrNonAgain: Record<string, number> = {};
  for (const l of recentLogs.data ?? []) {
    const lv = cardDiffLookup.get(l.card_id as string) ?? "unknown";
    cefrReviewTotals[lv] = (cefrReviewTotals[lv] ?? 0) + 1;
    if ((l.rating as number) !== 0) {
      cefrNonAgain[lv] = (cefrNonAgain[lv] ?? 0) + 1;
    }
  }
  const MIN_REVIEWS_FOR_ACC = 5;
  const cefrAccuracy: Record<string, number> = {};
  for (const lv of [...cefrOrder, "unknown"] as const) {
    const total = cefrReviewTotals[lv] ?? 0;
    if (total < MIN_REVIEWS_FOR_ACC) {
      cefrAccuracy[lv] = 1; // not enough data → don't penalize
    } else {
      cefrAccuracy[lv] = (cefrNonAgain[lv] ?? 0) / total;
    }
  }

  // Frequency-rank coverage model (see src/lib/vocab.ts). Each mastered
  // card's frequency_rank lands in a band; per-band vocab = min(band_size,
  // band_size × prior + mastered_in_band). Sum across bands.
  const masteredRankedCards = active
    .filter(isMastered)
    .map((c) => ({ frequency_rank: c.frequency_rank }));
  const vocabResult = computeVocabEstimate(masteredRankedCards);
  const vocabEstimate = vocabResult.total;
  const masteredCount = Object.values(masteredCefrCounts).reduce(
    (a, b) => a + b,
    0
  );
  const currentLevel = vocabCurrentLevel(vocabEstimate);
  const nextLevel = VOCAB_MILESTONES.find((m) => m.value > vocabEstimate);
  const toNext = nextLevel ? nextLevel.value - vocabEstimate : null;
  const cefrMax = Math.max(1, ...Object.values(cefrCounts));
  const cefrCoveredPct =
    active.length > 0
      ? Math.round(((active.length - cefrCounts.unknown) / active.length) * 100)
      : 0;
  const intervalBins = [
    { label: "0日 (未定着)", min: 0, max: 0, tone: "bg-muted" },
    { label: "1-6日", min: 1, max: 6, tone: "bg-flame/70" },
    { label: "7-20日", min: 7, max: 20, tone: "bg-accent/60" },
    { label: "21-60日 (定着)", min: 21, max: 60, tone: "bg-emerald-500/70" },
    { label: "61日以上 (マスター)", min: 61, max: Infinity, tone: "bg-emerald-500" },
  ].map((b) => ({
    ...b,
    count: active.filter(
      (c) => c.interval_days >= b.min && c.interval_days <= b.max
    ).length,
  }));
  const intervalMax = Math.max(1, ...intervalBins.map((b) => b.count));

  // === Ease distribution ===
  const easeBins = [
    { label: "底打ち (≤1.35)", test: (e: number) => e <= 1.35, tone: "bg-red-500/80" },
    { label: "1.35〜2.00", test: (e: number) => e > 1.35 && e <= 2.0, tone: "bg-amber-500/80" },
    { label: "2.00〜2.50", test: (e: number) => e > 2.0 && e <= 2.5, tone: "bg-emerald-500/70" },
    { label: "2.50超", test: (e: number) => e > 2.5, tone: "bg-sky-500/80" },
  ].map((b) => ({
    ...b,
    count: active.filter((c) => b.test(c.ease_factor)).length,
  }));
  const easeMax = Math.max(1, ...easeBins.map((b) => b.count));

  // === Retention (last 8 weeks) ===
  const weeks: {
    label: string;
    total: number;
    nonAgain: number;
    pct: number;
  }[] = [];
  const startOfWeek = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - copy.getDay()); // Sunday
    return copy;
  };
  for (let i = RETENTION_WEEKS - 1; i >= 0; i--) {
    const anchor = shiftDays(startOfWeek(now), -i * 7);
    const end = shiftDays(anchor, 7);
    const inRange = (recentLogs.data ?? []).filter((l) => {
      const t = new Date(l.reviewed_at as string).getTime();
      return t >= anchor.getTime() && t < end.getTime();
    });
    const nonAgain = inRange.filter((l) => (l.rating as number) !== 0).length;
    const totalW = inRange.length;
    weeks.push({
      label: `${anchor.getMonth() + 1}/${anchor.getDate()}`,
      total: totalW,
      nonAgain,
      pct: totalW > 0 ? Math.round((nonAgain / totalW) * 100) : 0,
    });
  }
  const weeksWithData = weeks.filter((w) => w.total > 0);
  const avgRetention =
    weeksWithData.length > 0
      ? Math.round(
          weeksWithData.reduce((s, w) => s + w.pct, 0) / weeksWithData.length
        )
      : 0;

  // === Forecast: per-day due load for the next 30 days ===
  const forecast: { key: string; count: number; overdue: boolean }[] = [];
  const forecastKeys: string[] = [];
  for (let i = 0; i <= FORECAST_DAYS; i++) {
    const key = ymdTokyo(shiftDays(now, i));
    forecastKeys.push(key);
    forecast.push({ key, count: 0, overdue: false });
  }
  const todayForecastKey = forecastKeys[0];
  for (const c of forecastRes.data ?? []) {
    const t = new Date(c.next_review_at as string);
    const overdue = t.getTime() <= now.getTime();
    const bucketKey = overdue ? todayForecastKey : ymdTokyo(t);
    const slot = forecast.find((f) => f.key === bucketKey);
    if (slot) {
      slot.count++;
      if (overdue) slot.overdue = true;
    }
  }
  const maxForecast = Math.max(1, ...forecast.map((f) => f.count));
  const forecastTotal = forecast.reduce((s, f) => s + f.count, 0);

  // === Hour-of-day distribution (A) + session metrics (B, D) ===
  const streakStamps = (streakLogs.data ?? [])
    .map((l) => new Date(l.reviewed_at as string).getTime())
    .sort((a, b) => a - b);

  const byHour = new Array(24).fill(0);
  for (const t of streakStamps) byHour[hourTokyo(new Date(t))]++;
  const peakHour = byHour.reduce(
    (best, count, h) => (count > best.count ? { h, count } : best),
    { h: 0, count: 0 }
  );
  const maxHour = Math.max(1, ...byHour);

  let sessionCount = 0;
  let sessionMs = 0;
  let longestSessionMs = 0;
  let curStart: number | null = null;
  let curEnd: number | null = null;
  for (let i = 0; i < streakStamps.length; i++) {
    const t = streakStamps[i];
    const next = streakStamps[i + 1];
    const gap = next !== undefined ? next - t : Infinity;
    if (curStart === null) {
      curStart = t;
      curEnd = t;
      sessionCount++;
    }
    // Add per-review time: cap short gaps in-session; last of session gets the cap itself.
    if (gap < SESSION_GAP_MS) {
      sessionMs += Math.min(gap, REVIEW_TIME_CAP_MS);
      curEnd = next ?? t;
    } else {
      sessionMs += REVIEW_TIME_CAP_MS;
      const len = (curEnd ?? t) - (curStart ?? t) + REVIEW_TIME_CAP_MS;
      if (len > longestSessionMs) longestSessionMs = len;
      curStart = null;
      curEnd = null;
    }
  }
  const totalMinutes = Math.round(sessionMs / 60_000);
  const todayMinutes = computeStudyMinutes(todayReviewedAts(streakReviewedAts));
  const avgSessionMinutes =
    sessionCount > 0
      ? Math.round((sessionMs / sessionCount / 60_000) * 10) / 10
      : 0;
  const longestMinutes = Math.round(longestSessionMs / 60_000);

  return (
    <PageShell title="進捗">
      <div className="py-4 flex flex-col gap-5 pb-8">
        {/* Vocabulary size estimate */}
        <Section
          title="推定総語彙"
          subtitle={`習得済 ${masteredCount} / ${active.length}枚 · CEFR判定 ${cefrCoveredPct}%`}
        >
          {/* Current level — full-bleed hero with overlaid text */}
          {currentLevel && (
            <div className="relative rounded-2xl overflow-hidden border border-accent/20 aspect-square bg-surface-2">
              <LevelAvatar
                image={currentLevel.image}
                emoji={currentLevel.emoji}
                size={512}
                alt={currentLevel.label}
                className="absolute inset-0 w-full h-full object-cover"
                fallbackClassName="absolute inset-0 w-full h-full flex items-center justify-center text-[140px]"
              />
              {/* Top pill */}
              <div className="absolute top-3 left-3 inline-flex items-center rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1">
                <span className="text-[9px] uppercase tracking-widest text-white/90 font-semibold">
                  Current Level
                </span>
              </div>
              {/* Bottom gradient + text */}
              <div className="absolute inset-x-0 bottom-0 pt-16 pb-4 px-4 bg-gradient-to-t from-black/85 via-black/55 to-transparent">
                <div className="flex items-end justify-between gap-3 text-white">
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-xl font-semibold leading-tight"
                      style={{ textShadow: "0 2px 8px rgba(0,0,0,.45)" }}
                    >
                      {currentLevel.label}
                    </span>
                    <span
                      className="text-[11px] text-white/85 leading-snug"
                      style={{ textShadow: "0 1px 4px rgba(0,0,0,.45)" }}
                    >
                      {currentLevel.sub}
                    </span>
                  </div>
                  <div
                    className="flex items-baseline gap-1 shrink-0"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,.5)" }}
                  >
                    <span className="text-3xl font-semibold tabular-nums leading-none">
                      {vocabEstimate.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-white/80">語</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Next-level progress */}
          {nextLevel && toNext !== null && (
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-baseline justify-between text-[10px] gap-2">
                <span className="text-muted truncate">
                  次: {nextLevel.label}
                </span>
                <span className="tabular-nums shrink-0">
                  あと <span className="font-semibold">{toNext.toLocaleString()}</span> 語
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                <div
                  className="h-full bg-accent transition-[width] duration-500"
                  style={{
                    width: `${currentLevel
                      ? Math.min(
                          100,
                          ((vocabEstimate - currentLevel.value) /
                            (nextLevel.value - currentLevel.value)) *
                            100
                        )
                      : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* CEFR distribution histogram with accuracy */}
          <SubTitle label="CEFR分布" right="カード数 · 正答率" />
          <div className="flex flex-col gap-1">
            {cefrOrder.map((lv) => {
              const n = cefrCounts[lv];
              const pct = (n / cefrMax) * 100;
              const reviews = cefrReviewTotals[lv] ?? 0;
              const acc =
                reviews >= MIN_REVIEWS_FOR_ACC
                  ? Math.round((cefrAccuracy[lv] ?? 0) * 100)
                  : null;
              const tone =
                lv === "A1" || lv === "A2"
                  ? "bg-muted"
                  : lv === "B1"
                    ? "bg-flame/60"
                    : lv === "B2"
                      ? "bg-flame/80"
                      : lv === "C1"
                        ? "bg-accent"
                        : "bg-success";
              return (
                <div
                  key={lv}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span className="w-7 shrink-0 text-muted font-mono font-semibold">
                    {lv}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-border/40 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${tone} transition-[width] duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums font-medium">
                    {n}
                  </span>
                  <span
                    className={`w-10 text-right text-[10px] tabular-nums ${
                      acc === null
                        ? "text-muted/50"
                        : acc >= 80
                          ? "text-success font-semibold"
                          : acc >= 60
                            ? "text-muted"
                            : "text-danger"
                    }`}
                  >
                    {acc === null ? "—" : `${acc}%`}
                  </span>
                </div>
              );
            })}
            {cefrCounts.unknown > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                <span>未判定 {cefrCounts.unknown}枚</span>
              </div>
            )}
          </div>

          {/* All milestones with ✓/○ — 30 levels scrollable */}
          <SubTitle label="マイルストーン" right={`${VOCAB_MILESTONES.length}段階`} />
          <div className="flex flex-col gap-0.5 max-h-80 overflow-y-auto pr-1 -mr-1">
            {VOCAB_MILESTONES.map((m) => {
              const reached = vocabEstimate >= m.value;
              const isCurrent = currentLevel?.value === m.value;
              return (
                <div
                  key={m.label}
                  className={`flex items-center gap-2 text-[11px] rounded-lg px-2 py-1 ${
                    isCurrent
                      ? "bg-accent-soft border border-accent/20"
                      : ""
                  }`}
                >
                  <span className="w-6 h-6 shrink-0 flex items-center justify-center">
                    <LevelAvatar
                      image={m.image}
                      emoji={m.emoji}
                      size={22}
                      alt={m.label}
                    />
                  </span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className={`leading-tight truncate ${
                        isCurrent
                          ? "font-semibold"
                          : reached
                            ? "font-medium"
                            : "text-muted"
                      }`}
                    >
                      {m.label}
                    </span>
                    <span className="text-[9px] text-muted truncate">
                      {m.sub}
                    </span>
                  </div>
                  <span
                    className={`tabular-nums text-[10px] shrink-0 ${
                      reached ? "text-success font-semibold" : "text-muted"
                    }`}
                  >
                    {reached ? "✓" : "○"} {m.value.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Goals: short / mid / long term targets */}
        <Section
          title="目標"
          subtitle={`年末予測 ${projectedYear.toLocaleString()}語`}
        >
          <GoalRow
            label="今日"
            value={dayIntrosCount}
            target={DAILY_NEW_TARGET}
          />
          <GoalRow
            label="今週"
            value={weekIntrosCount}
            target={WEEKLY_NEW_TARGET}
          />
          <GoalRow
            label="今四半期"
            value={quarterIntrosCount}
            target={QUARTERLY_NEW_TARGET}
          />
          <GoalRow
            label="今年"
            value={yearIntrosCount}
            target={YEARLY_NEW_TARGET}
          />
          <p className="text-[10px] text-muted mt-1 leading-relaxed">
            {DAILY_NEW_TARGET}枚/日を続けると1年で{YEARLY_NEW_TARGET.toLocaleString()}語。
            {projectedYear >= YEARLY_NEW_TARGET
              ? ` 今のペースなら年末 ${projectedYear.toLocaleString()} で達成見込み ✓`
              : ` 残り${daysLeftInYear}日で目標達成するには 1日 ${Math.max(
                  0,
                  Math.ceil(
                    (YEARLY_NEW_TARGET - yearIntrosCount) /
                      Math.max(1, daysLeftInYear)
                  )
                )}枚 ペース必要`}
          </p>
        </Section>

        {/* Summary */}
        <section className="grid grid-cols-3 gap-2">
          <SummaryCell
            label="総カード"
            value={total}
            sub={`定着 ${mastered} / ${active.length} (${masteredPct}%)`}
          />
          <SummaryCell
            label="今日"
            value={todayCount}
            sub={`ストリーク ${streak}日`}
            tone="flame"
          />
          <SummaryCell
            label="全期間"
            value={totalLogs}
            sub="累計レビュー回数"
            tone="accent"
          />
        </section>

        {/* Momentum */}
        <Section title="学習の勢い" subtitle={`直近${MOMENTUM_DAYS}日`}>
          {/* New intros */}
          <SubTitle label="新規取り込み" right={`目標 ${DAILY_NEW_TARGET}/日`} />
          <div className="flex items-end gap-[2px] h-16 relative">
            <div
              aria-hidden
              className="absolute left-0 right-0 border-t border-dashed border-muted/40"
              style={{ bottom: `${(DAILY_NEW_TARGET / maxIntro) * 100}%` }}
            />
            {intros.map((n, i) => (
              <div
                key={i}
                title={`${momentumDays[i]}: ${n}枚`}
                className="flex-1 bg-accent/80 rounded-sm transition-opacity"
                style={{
                  height: `${Math.max(n > 0 ? 4 : 0, (n / maxIntro) * 100)}%`,
                  opacity: n === 0 ? 0.2 : 1,
                }}
              />
            ))}
          </div>
          <DayAxis days={momentumDays} />

          {/* Rating stack */}
          <div className="h-3" />
          <SubTitle label="復習ペース (評価別)" />
          <div className="flex items-end gap-[2px] h-20">
            {grades.map((g, i) => {
              const tot = g[0] + g[1] + g[2] + g[3];
              const pct = (tot / maxGradeTotal) * 100;
              return (
                <div
                  key={i}
                  title={`${momentumDays[i]}: ${tot}回 (R${g[0]}/H${g[1]}/G${g[2]}/E${g[3]})`}
                  className="flex-1 flex flex-col justify-end rounded-sm overflow-hidden"
                  style={{
                    height: `${Math.max(tot > 0 ? 4 : 0, pct)}%`,
                  }}
                >
                  {([0, 1, 2, 3] as Grade[]).map((r) =>
                    g[r] > 0 ? (
                      <div
                        key={r}
                        className={GRADE_META[r].cls}
                        style={{ flex: g[r] }}
                      />
                    ) : null
                  )}
                </div>
              );
            })}
          </div>
          <DayAxis days={momentumDays} />
          <Legend />
        </Section>

        {/* Interval distribution */}
        <Section title="間隔分布" subtitle={`${active.length}枚 · 休止除く`}>
          <div className="flex flex-col gap-1.5">
            {intervalBins.map((b) => (
              <BinRow
                key={b.label}
                label={b.label}
                count={b.count}
                max={intervalMax}
                tone={b.tone}
              />
            ))}
          </div>
        </Section>

        {/* Ease distribution */}
        <Section title="Ease分布" subtitle="難度の地図">
          <div className="flex flex-col gap-1.5">
            {easeBins.map((b) => (
              <BinRow
                key={b.label}
                label={b.label}
                count={b.count}
                max={easeMax}
                tone={b.tone}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted mt-1 leading-relaxed">
            Ease=苦手度の係数 (SM-2)。Again重ねると落ちて1.3で止まる。
            底打ちカードはleechとして自動抽出。
          </p>
        </Section>

        {/* Retention */}
        <Section
          title="定着率の推移"
          subtitle={`直近${RETENTION_WEEKS}週 · 平均 ${avgRetention}%`}
        >
          <div className="flex items-end justify-between gap-2 h-24">
            {weeks.map((w, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end gap-1"
                title={`${w.label}: ${w.nonAgain}/${w.total} keep (${w.pct}%)`}
              >
                {w.total > 0 ? (
                  <>
                    <span className="text-[9px] font-semibold tabular-nums">
                      {w.pct}%
                    </span>
                    <div
                      className={`w-full rounded-sm ${
                        w.pct >= 85
                          ? "bg-emerald-500"
                          : w.pct >= 70
                            ? "bg-emerald-500/60"
                            : w.pct >= 50
                              ? "bg-amber-500/80"
                              : "bg-red-500/80"
                      }`}
                      style={{ height: `${Math.max(4, w.pct)}%` }}
                    />
                  </>
                ) : (
                  <div className="w-full h-[4px] rounded-sm bg-border/40" />
                )}
                <span className="text-[9px] text-muted tabular-nums">
                  {w.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            (Hard + Good + Easy) ÷ 全レビュー。Again率の裏返し。
            85%超なら健全、50%未満なら新規投入を絞るサイン。
          </p>
        </Section>

        {/* Forecast */}
        <Section
          title="予定復習数"
          subtitle={`次${FORECAST_DAYS}日 · 計 ${forecastTotal}枚`}
        >
          <div className="flex items-end gap-[2px] h-20">
            {forecast.map((f, i) => {
              const pct = (f.count / maxForecast) * 100;
              const isToday = i === 0;
              return (
                <div
                  key={f.key}
                  title={`${f.key}: ${f.count}枚${f.overdue ? " (期限切れ含)" : ""}`}
                  className={`flex-1 rounded-sm transition-opacity ${
                    isToday
                      ? "bg-flame/80"
                      : f.count === 0
                        ? "bg-border/40"
                        : "bg-accent/70"
                  }`}
                  style={{
                    height: `${Math.max(f.count > 0 ? 4 : 2, pct)}%`,
                    opacity: f.count === 0 ? 0.3 : 1,
                  }}
                />
              );
            })}
          </div>
          <DayAxis days={forecast.map((f) => f.key)} />
          <p className="text-[10px] text-muted mt-1 leading-relaxed">
            今日の棒は期限切れも合算。旅行や試験前の負荷を事前に把握できる。
          </p>
        </Section>

        {/* Time-of-day + session metrics */}
        <Section
          title="学習時間"
          subtitle={`直近100日 · 推定${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`}
        >
          {/* Session summary: today's minutes up front, 3-col details below */}
          <div className="grid grid-cols-2 gap-2">
            <TimeStat label="今日" value={`${todayMinutes}`} sub="分" />
            <TimeStat
              label="セッション"
              value={`${sessionCount}`}
              sub="回"
            />
            <TimeStat
              label="平均"
              value={`${avgSessionMinutes}`}
              sub="分/回"
            />
            <TimeStat
              label="最長"
              value={`${longestMinutes}`}
              sub="分"
            />
          </div>

          {/* Hour of day histogram */}
          <SubTitle
            label="時刻分布"
            right={
              peakHour.count > 0 ? `ピーク ${peakHour.h}時 (${peakHour.count}回)` : undefined
            }
          />
          <div className="flex items-end gap-[2px] h-16">
            {byHour.map((n, h) => (
              <div
                key={h}
                title={`${h}時: ${n}回`}
                className={`flex-1 rounded-sm ${
                  n === 0 ? "bg-border/40" : "bg-accent/70"
                }`}
                style={{
                  height: `${Math.max(n > 0 ? 4 : 2, (n / maxHour) * 100)}%`,
                  opacity: n === 0 ? 0.3 : 1,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-muted tabular-nums mt-0.5">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>24h</span>
          </div>
          <p className="text-[10px] text-muted mt-1 leading-relaxed">
            セッション = 5分以上間隔が空くまでの連続レビュー。
            各レビュー最大60秒でカウント (バックグラウンド放置を補正)。
          </p>
        </Section>
      </div>
    </PageShell>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface-2 p-4 flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <span className="text-[10px] text-muted">{subtitle}</span>
        )}
      </header>
      {children}
    </section>
  );
}

function SubTitle({ label, right }: { label: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between mt-1">
      <span className="text-[10px] uppercase tracking-widest text-muted font-semibold">
        {label}
      </span>
      {right && <span className="text-[9px] text-muted">{right}</span>}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: number;
  sub?: string;
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
      <div className={`text-xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[9px] text-muted leading-snug">{sub}</div>
      )}
    </div>
  );
}

function GoalRow({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target: number;
}) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const done = value >= target;
  const barColor = done
    ? "bg-success"
    : pct >= 50
      ? "bg-accent"
      : "bg-flame/70";
  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold">{label}</span>
        <span className="text-[11px] tabular-nums">
          <span className={done ? "text-success font-semibold" : "font-semibold"}>
            {value.toLocaleString()}
          </span>
          <span className="text-muted"> / {target.toLocaleString()}</span>
          {done && <span className="text-success ml-1">✓</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TimeStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-background/60 p-2.5 flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-widest text-muted font-semibold">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">
        {value}
        {sub && <span className="text-[10px] text-muted ml-0.5">{sub}</span>}
      </span>
    </div>
  );
}

function BinRow({
  label,
  count,
  max,
  tone,
}: {
  label: string;
  count: number;
  max: number;
  tone: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-28 shrink-0 truncate text-muted">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-border/40 overflow-hidden">
        <div
          className={`h-full rounded-full ${tone} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-semibold tabular-nums">
        {count}
      </span>
    </div>
  );
}

function DayAxis({ days }: { days: string[] }) {
  // Show first, mid, last date labels
  const first = days[0] ?? "";
  const mid = days[Math.floor(days.length / 2)] ?? "";
  const last = days[days.length - 1] ?? "";
  return (
    <div className="flex justify-between text-[9px] text-muted tabular-nums mt-0.5">
      <span>{first.slice(5)}</span>
      <span>{mid.slice(5)}</span>
      <span>{last.slice(5)}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[9px] text-muted mt-1">
      {([0, 1, 2, 3] as Grade[]).map((r) => (
        <span key={r} className="inline-flex items-center gap-1">
          <span className={`w-2 h-2 rounded-sm ${GRADE_META[r].dot}`} />
          {GRADE_META[r].label}
        </span>
      ))}
    </div>
  );
}
