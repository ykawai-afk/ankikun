// Single source of truth for new-card intake goals. Hardcoded now; can grow
// into a settings table later once the numbers feel right.
export const DAILY_NEW_TARGET = 25;
export const WEEKLY_NEW_TARGET = 150;
export const QUARTERLY_NEW_TARGET = 1500;
export const YEARLY_NEW_TARGET = 6000;

// Vocabulary size estimation. Baseline is the pre-Ankikun floor (鉄壁完遂
// @ 一橋 → 減衰後). Card weights only count words the user likely didn't
// already have — so the cheaper CEFR levels contribute nothing (rehearsal
// rather than expansion) and only the upper bands add to the tally.
export const VOCAB_BASELINE = 8000;
export const VOCAB_CARD_WEIGHT: Record<string, number> = {
  A1: 0,
  A2: 0,
  B1: 0,
  B2: 0.2,
  C1: 0.7,
  C2: 1.0,
  unknown: 0.3,
};

// Current-level badge. The highest entry whose `value` is ≤ estimate is
// picked as the user's current milestone. Add an `image` path once a
// Midjourney render is dropped into public/levels/ — UI falls back to the
// emoji when the image field is missing.
export type VocabMilestone = {
  value: number;
  label: string;
  sub: string;
  emoji: string;
  image?: string;
};

export const VOCAB_MILESTONES: VocabMilestone[] = [
  {
    value: 2_000,
    label: "The Curious Toddler",
    sub: "好奇心旺盛な幼児 · 米国3歳並み",
    emoji: "🧸",
    image: "/levels/toddler.png",
  },
  {
    value: 4_000,
    label: "The Playground Rascal",
    sub: "園庭の暴れん坊 · 米国5歳並み",
    emoji: "🧒",
    image: "/levels/kindergartener.png",
  },
  {
    value: 7_000,
    label: "The Bookworm Beginner",
    sub: "駆け出し本の虫 · 米国小2並み",
    emoji: "📚",
    image: "/levels/second-grader.png",
  },
  {
    value: 10_000,
    label: "The Nerdy 5th Grader",
    sub: "ガリ勉小5 · 英検1級",
    emoji: "🏫",
    image: "/levels/fifth-grader.png",
  },
  {
    value: 15_000,
    label: "The Rebel Eighth Grader",
    sub: "反抗期の中2 · TOEFL 100+",
    emoji: "🎒",
    image: "/levels/eighth-grader.png",
  },
  {
    value: 20_000,
    label: "The Varsity Valedictorian",
    sub: "米高校トップ卒 · GPA 4.0",
    emoji: "🎓",
    image: "/levels/hs-senior.png",
  },
  {
    value: 30_000,
    label: "The Coffee-Fueled Grad",
    sub: "徹夜明けの大卒 · 論文書き終えた顔",
    emoji: "☕",
    image: "/levels/college-grad.png",
  },
  {
    value: 40_000,
    label: "The Corner Office Pro",
    sub: "役員室の教養層ネイティブ",
    emoji: "👔",
    image: "/levels/professional.png",
  },
];

export function vocabCurrentLevel(
  estimate: number
): (typeof VOCAB_MILESTONES)[number] | null {
  let current: (typeof VOCAB_MILESTONES)[number] | null = null;
  for (const m of VOCAB_MILESTONES) {
    if (estimate >= m.value) current = m;
    else break;
  }
  return current;
}

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
