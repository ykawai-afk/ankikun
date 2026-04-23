// Canonical definitions for "mastered" and "active" card states. Every page
// that shows a mastered count, a mastered %, or an active-cards denominator
// must route through this file — otherwise two screens can disagree on the
// same word.
//
// "Mastered" = interval_days ≥ 21 OR user rated Easy on their very first
// review. The 21d threshold is the canonical SM-2 signal that SRS has
// learned the card. Intro-Easy is a separate path: rating Easy first-pass
// means the user already knew the word (SM-2 still gives a 1d interval,
// but the card's history proves retention so we count it immediately).
//
// "Active" = anything except status="suspended". Suspended cards are outside
// the active learning loop, so mastered % should be "of what I'm learning"
// rather than "of everything I've ever owned".

export const MASTERED_THRESHOLD_DAYS = 21;

export function isMastered(card: {
  interval_days: number;
  was_intro_easy?: boolean;
}): boolean {
  return (
    card.interval_days >= MASTERED_THRESHOLD_DAYS ||
    card.was_intro_easy === true
  );
}

export function isActive(card: { status: string }): boolean {
  return card.status !== "suspended";
}

// Review-log predicate: a log row represents a brand-new card's first rating
// iff the card was at factory state (interval 0, ease 2.5) right before this
// grading. Matches what home, review, stats, and the daily-summary API all
// need when counting "new intros".
export function isIntroLog(log: {
  prev_interval: number | null;
  prev_ease: number | null;
}): boolean {
  return log.prev_interval === 0 && log.prev_ease === 2.5;
}
