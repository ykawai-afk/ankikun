// Single source of truth for new-card intake goals. Hardcoded now; can grow
// into a settings table later once the numbers feel right.
export const DAILY_NEW_TARGET = 25;
export const WEEKLY_NEW_TARGET = 150;
export const QUARTERLY_NEW_TARGET = 1500;
export const YEARLY_NEW_TARGET = 6000;

export const TZ = "Asia/Tokyo";

export function jstStartOfDay(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // parts is "YYYY-MM-DD"
  return new Date(`${parts}T00:00:00+09:00`);
}

export function jstStartOfWeek(now: Date = new Date()): Date {
  const today = jstStartOfDay(now);
  // JST weekday
  const wdStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(today);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const wd = map[wdStr] ?? 0;
  today.setDate(today.getDate() - wd);
  return today;
}

export function jstStartOfQuarter(now: Date = new Date()): Date {
  const today = jstStartOfDay(now);
  const monthStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "2-digit",
  }).format(now);
  const yearStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
  }).format(now);
  const month = Number(monthStr);
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return new Date(
    `${yearStr}-${String(quarterStartMonth).padStart(2, "0")}-01T00:00:00+09:00`
  );
  void today;
}

export function jstStartOfYear(now: Date = new Date()): Date {
  const yearStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
  }).format(now);
  return new Date(`${yearStr}-01-01T00:00:00+09:00`);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
