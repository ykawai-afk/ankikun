import { createAdminClient } from "@/lib/supabase/admin";
import { isIntroLog } from "@/lib/mastery";

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

// 30 levels, weighted toward the 8k–40k range where the user will actually
// spend most of their time. Early bands (<8k) are sparse nostalgia; >40k is
// aspirational. Each character has its own personality name and image slot.
export const VOCAB_MILESTONES: VocabMilestone[] = [
  // Pre-literacy nostalgia (4)
  { value: 500,   label: "The Babbling Baby",              sub: "初語の赤ちゃん",                         emoji: "👶", image: "/levels/babbling-baby.png" },
  { value: 2_000, label: "The Toddler Chatterbox",         sub: "おしゃべり幼児 · 米国3歳並み",             emoji: "🧸", image: "/levels/toddler-chatterbox.png" },
  { value: 4_000, label: "The Preschool Questioner",       sub: "質問魔の未就園児",                       emoji: "❓", image: "/levels/preschool-questioner.png" },
  { value: 6_500, label: "The 1st Grade Storyteller",      sub: "小1の物語屋",                            emoji: "📖", image: "/levels/first-grade-storyteller.png" },

  // User's current territory + growth (22)
  { value: 8_000,  label: "The 2nd Grade Bookworm",         sub: "本の虫駆け出し · 米国小2",              emoji: "📚", image: "/levels/second-grade-bookworm.png" },
  { value: 9_500,  label: "The 3rd Grade Daydreamer",       sub: "空想好きの小3",                          emoji: "💭", image: "/levels/third-grade-daydreamer.png" },
  { value: 11_000, label: "The Spelling Bee Rookie",        sub: "スペリングビー新人",                     emoji: "🐝", image: "/levels/spelling-bee-rookie.png" },
  { value: 12_500, label: "The Nerdy 5th Grader",           sub: "ガリ勉小5 · 英検1級",                    emoji: "🤓", image: "/levels/nerdy-fifth-grader.png" },
  { value: 14_000, label: "The 6th Grade Know-It-All",      sub: "知ったかぶり小6",                        emoji: "☝️", image: "/levels/sixth-grade-know-it-all.png" },
  { value: 15_500, label: "The Middle School Debater",      sub: "中学弁論部員",                           emoji: "🎙️", image: "/levels/middle-school-debater.png" },
  { value: 17_000, label: "The Rebel 8th Grader",           sub: "反抗期の中2 · TOEFL 100+",              emoji: "🛹", image: "/levels/rebel-eighth-grader.png" },
  { value: 18_500, label: "The Freshman Overachiever",      sub: "高1優等生",                              emoji: "🎒", image: "/levels/freshman-overachiever.png" },
  { value: 20_000, label: "The AP Lit Sophomore",           sub: "AP英文学の高2",                          emoji: "📝", image: "/levels/ap-lit-sophomore.png" },
  { value: 21_500, label: "The Junior Editor",              sub: "高3の新聞部編集",                        emoji: "📰", image: "/levels/junior-editor.png" },
  { value: 23_000, label: "The Varsity Valedictorian",      sub: "卒業生総代 · GPA 4.0",                   emoji: "🏆", image: "/levels/varsity-valedictorian.png" },
  { value: 24_500, label: "The National Merit Finalist",    sub: "国家奨学生決勝",                         emoji: "🥇", image: "/levels/national-merit-finalist.png" },
  { value: 26_000, label: "The Liberal Arts Freshman",      sub: "教養学部1年",                            emoji: "🎭", image: "/levels/liberal-arts-freshman.png" },
  { value: 27_500, label: "The English Major",              sub: "英文学専攻",                             emoji: "📗", image: "/levels/english-major.png" },
  { value: 29_000, label: "The Creative Writing Workshopper", sub: "創作ワークショップ生",                 emoji: "✍️", image: "/levels/creative-writing-workshopper.png" },
  { value: 30_500, label: "The Coffee-Fueled Grad",         sub: "徹夜明けの大卒",                         emoji: "☕", image: "/levels/coffee-fueled-grad.png" },
  { value: 32_000, label: "The Graduate TA",                sub: "院生ティーチングアシスタント",           emoji: "🧑‍🏫", image: "/levels/graduate-ta.png" },
  { value: 33_500, label: "The PhD Candidate",              sub: "博士候補",                               emoji: "🧪", image: "/levels/phd-candidate.png" },
  { value: 35_000, label: "The Dissertation Survivor",      sub: "論文防衛突破者",                         emoji: "📑", image: "/levels/dissertation-survivor.png" },
  { value: 36_500, label: "The Post-Doc Scholar",           sub: "ポスドク研究者",                         emoji: "🔬", image: "/levels/postdoc-scholar.png" },
  { value: 38_000, label: "The Tenured Professor",          sub: "終身在職教授",                           emoji: "🎓", image: "/levels/tenured-professor.png" },
  { value: 40_000, label: "The Corner Office Pro",          sub: "役員室の教養層ネイティブ",               emoji: "👔", image: "/levels/corner-office-pro.png" },

  // Aspirational (4)
  { value: 44_000, label: "The Newsroom Editor-in-Chief",   sub: "編集長",                                 emoji: "🗞️", image: "/levels/newsroom-editor.png" },
  { value: 48_000, label: "The Published Novelist",         sub: "出版作家",                               emoji: "🖋️", image: "/levels/published-novelist.png" },
  { value: 55_000, label: "The Lexicographer",              sub: "辞書編纂者",                             emoji: "📕", image: "/levels/lexicographer.png" },
  { value: 70_000, label: "The Shakespearean Savant",       sub: "シェイクスピア級の語彙匠",              emoji: "🎭", image: "/levels/shakespearean-savant.png" },
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

// Count how many new cards have been introduced since `since` (defaults to
// JST start of today). Used by home and review to gate the daily new quota.
// Both pages previously inlined the same Supabase query — diverging on wall-
// clock `since` during navigation produced the race the user felt.
export async function countNewIntrosSince(
  userId: string,
  since: Date = jstStartOfDay()
): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("prev_interval", 0)
    .eq("prev_ease", 2.5)
    .gte("reviewed_at", since.toISOString());
  return count ?? 0;
}

// Re-exported so callers iterating logs in memory share the same predicate.
export { isIntroLog };
