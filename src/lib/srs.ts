import type { Card, CardStatus, Rating } from "./types";

export type SrsState = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string;
  status: CardStatus;
};

// Map 4-button rating → SM-2 quality (0..5)
// Again=0 → q=0 (failure), Hard=1 → q=3, Good=2 → q=4, Easy=3 → q=5
const RATING_TO_QUALITY: Record<Rating, number> = { 0: 0, 1: 3, 2: 4, 3: 5 };

export function schedule(
  card: Pick<Card, "ease_factor" | "interval_days" | "repetitions">,
  rating: Rating,
  now: Date = new Date()
): SrsState {
  const q = RATING_TO_QUALITY[rating];
  const prevEase = card.ease_factor;

  let interval_days: number;
  let repetitions: number;
  let status: CardStatus;

  if (q < 3) {
    // 失敗: 学習フェーズに戻し、当日中に再出題
    repetitions = 0;
    interval_days = 0;
    status = "learning";
  } else {
    if (card.repetitions === 0) interval_days = 1;
    else if (card.repetitions === 1) interval_days = 6;
    else interval_days = Math.round(card.interval_days * prevEase);
    repetitions = card.repetitions + 1;
    status = repetitions >= 2 ? "review" : "learning";
  }

  const ease_factor = Math.max(
    1.3,
    prevEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  const next = new Date(now.getTime() + interval_days * 86_400_000);

  return {
    ease_factor: round2(ease_factor),
    interval_days,
    repetitions,
    next_review_at: next.toISOString(),
    last_reviewed_at: now.toISOString(),
    status,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
