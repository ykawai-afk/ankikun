import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { PageShell } from "@/components/page-shell";
import { computeStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

const DAILY_NEW_TARGET = 50;
const MASTERED_THRESHOLD_DAYS = 21;
const MOMENTUM_DAYS = 30;
const RETENTION_WEEKS = 8;

const TZ = "Asia/Tokyo";
function ymdTokyo(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}
function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
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

export default async function StatsPage() {
  const supabase = createAdminClient();
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

  const [
    totalRes,
    masteredRes,
    activeRes,
    totalLogsRes,
    recentLogs,
    streakLogs,
  ] = await Promise.all([
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("interval_days", MASTERED_THRESHOLD_DAYS),
    supabase
      .from("cards")
      .select("interval_days, ease_factor")
      .eq("user_id", userId)
      .neq("status", "suspended"),
    supabase
      .from("review_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("review_logs")
      .select("rating, prev_interval, prev_ease, reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", retentionFrom)
      .order("reviewed_at", { ascending: true }),
    supabase
      .from("review_logs")
      .select("reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", ninetyAgo),
  ]);

  const total = totalRes.count ?? 0;
  const mastered = masteredRes.count ?? 0;
  const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const totalLogs = totalLogsRes.count ?? 0;
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
    const isNewIntro =
      (l.prev_interval as number) === 0 && (l.prev_ease as number) === 2.5;
    if (isNewIntro) dayIntros.set(key, (dayIntros.get(key) ?? 0) + 1);
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
    interval_days: number;
    ease_factor: number;
  }[];
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

  return (
    <PageShell title="進捗">
      <div className="py-4 flex flex-col gap-5 pb-8">
        {/* Summary */}
        <section className="grid grid-cols-3 gap-2">
          <SummaryCell
            label="総カード"
            value={total}
            sub={`定着 ${mastered} / ${total} (${masteredPct}%)`}
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
