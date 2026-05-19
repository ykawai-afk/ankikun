// Frequency-rank-based vocabulary estimator. Replaces the previous
// CEFR-weight-plus-baseline model with a lexical-coverage approach:
//
//   vocab = Σ over bands of: min(band_size, band_size × prior + mastered_in_band)
//
// Where `prior` is a fixed coverage curve for the user's profile.
// `mastered_in_band` is the count of mastered cards whose frequency_rank
// sits in the band — those represent words the user explicitly demonstrated
// they know via SM-2 interval ≥ 21d. The min() cap prevents a user with
// many cards in a narrow band from "over-covering" the band.
//
// Ankikun cards are self-selected (user only adds words they encounter and
// didn't already know), so mastered-card contribution is largely additive
// to the prior. If a user's actual prior is lower than the curve assumes,
// the estimate is optimistic; if higher, pessimistic.
//
// Calibration (2026-05-19): re-anchored to ~5,500 mastered-less total,
// matching the post-triage VOCAB_BASELINE in goals.ts. The earlier
// curve assumed 鉄壁 @ 一橋 prep was fully retained, which the May-18
// triage test showed was overoptimistic (B2 strong / C1 entry decayed
// hard). Reduced priors on the 3k–12k bands accordingly.

export type FrequencyBand = {
  rank: number; // canonical midpoint stored on cards.frequency_rank
  size: number; // number of words in the band
  prior: number; // estimated coverage for the user's profile [0, 1]
  label: string;
};

export const FREQUENCY_BANDS: FrequencyBand[] = [
  { rank: 250, size: 500, prior: 1.0, label: "1–500" },
  { rank: 750, size: 1000, prior: 0.95, label: "501–1500" },
  { rank: 2000, size: 1500, prior: 0.8, label: "1501–3000" },
  { rank: 4000, size: 2000, prior: 0.6, label: "3001–5000" },
  { rank: 6500, size: 3000, prior: 0.3, label: "5001–8000" },
  { rank: 10000, size: 4000, prior: 0.1, label: "8001–12000" },
  { rank: 15000, size: 8000, prior: 0.03, label: "12001–20000" },
  { rank: 28000, size: 20000, prior: 0.005, label: "20001–40000" },
  { rank: 50000, size: 20000, prior: 0.001, label: "40001+" },
];

export type VocabBreakdown = {
  bandRank: number;
  bandLabel: string;
  bandSize: number;
  prior: number;
  masteredInBand: number;
  knownInBand: number; // min(bandSize, bandSize × prior + masteredInBand)
};

export type VocabEstimate = {
  total: number;
  breakdown: VocabBreakdown[];
  priorOnly: number; // what the total would be without any mastered-card bonus
};

export function computeVocabEstimate(
  masteredCards: { frequency_rank: number | null }[]
): VocabEstimate {
  const counts = new Map<number, number>();
  for (const c of masteredCards) {
    if (c.frequency_rank === null) continue;
    counts.set(c.frequency_rank, (counts.get(c.frequency_rank) ?? 0) + 1);
  }

  let total = 0;
  let priorOnly = 0;
  const breakdown: VocabBreakdown[] = [];
  for (const band of FREQUENCY_BANDS) {
    const masteredInBand = counts.get(band.rank) ?? 0;
    const priorWords = band.size * band.prior;
    const known = Math.min(band.size, priorWords + masteredInBand);
    total += known;
    priorOnly += priorWords;
    breakdown.push({
      bandRank: band.rank,
      bandLabel: band.label,
      bandSize: band.size,
      prior: band.prior,
      masteredInBand,
      knownInBand: known,
    });
  }

  return {
    total: Math.round(total),
    breakdown,
    priorOnly: Math.round(priorOnly),
  };
}
