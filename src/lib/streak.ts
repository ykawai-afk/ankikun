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

export function computeStreak(reviewedAtIsoStrings: string[]): number {
  if (reviewedAtIsoStrings.length === 0) return 0;
  const days = new Set(reviewedAtIsoStrings.map((iso) => ymdInTokyo(new Date(iso))));
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
