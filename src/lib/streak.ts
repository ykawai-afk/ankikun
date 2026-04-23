// Compute consecutive-day streak from review_logs timestamps.
// Day boundaries are evaluated in Asia/Tokyo. A streak stays alive if the
// user reviewed yesterday, even if they haven't started today yet.

const TZ = "Asia/Tokyo";

function ymdInTokyo(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function addDays(ymd: string, delta: number): string {
  // ymd like "2026-04-20"
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function computeStreak(
  reviewedAtIsoStrings: string[],
  frozenYmdDays: string[] = []
): number {
  if (reviewedAtIsoStrings.length === 0 && frozenYmdDays.length === 0) return 0;
  // Frozen days count as covered — the user spent a freeze to paper
  // over the gap, so the streak walks right through them.
  const days = new Set<string>([
    ...reviewedAtIsoStrings.map((iso) => ymdInTokyo(new Date(iso))),
    ...frozenYmdDays,
  ]);
  let streak = 0;
  const today = ymdInTokyo(new Date());
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function reviewedTodayCount(reviewedAtIsoStrings: string[]): number {
  const today = ymdInTokyo(new Date());
  return reviewedAtIsoStrings.filter(
    (iso) => ymdInTokyo(new Date(iso)) === today
  ).length;
}

export function countsByDay(
  reviewedAtIsoStrings: string[]
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const iso of reviewedAtIsoStrings) {
    const day = ymdInTokyo(new Date(iso));
    acc[day] = (acc[day] ?? 0) + 1;
  }
  return acc;
}

export function todayReviewedAts(reviewedAtIsoStrings: string[]): string[] {
  const today = ymdInTokyo(new Date());
  return reviewedAtIsoStrings.filter(
    (iso) => ymdInTokyo(new Date(iso)) === today
  );
}

// Estimate total study minutes from a list of review timestamps. A gap of
// more than `gapMs` ends a session; each review inside a session counts
// for at most `capMs` (to avoid crediting phone-down / distraction time).
// Last review of a session gets the cap itself. Same algorithm the stats
// page has used — pulled here so home can re-use without duplicating.
const DEFAULT_SESSION_GAP_MS = 5 * 60_000;
const DEFAULT_REVIEW_CAP_MS = 60_000;

export function computeStudyMinutes(
  reviewedAtIsoStrings: string[],
  opts: { sessionGapMs?: number; reviewCapMs?: number } = {}
): number {
  const gapMs = opts.sessionGapMs ?? DEFAULT_SESSION_GAP_MS;
  const capMs = opts.reviewCapMs ?? DEFAULT_REVIEW_CAP_MS;
  const stamps = reviewedAtIsoStrings
    .map((s) => new Date(s).getTime())
    .sort((a, b) => a - b);
  let ms = 0;
  for (let i = 0; i < stamps.length; i++) {
    const t = stamps[i];
    const next = stamps[i + 1];
    const gap = next !== undefined ? next - t : Infinity;
    if (gap < gapMs) ms += Math.min(gap, capMs);
    else ms += capMs;
  }
  return Math.round(ms / 60_000);
}
