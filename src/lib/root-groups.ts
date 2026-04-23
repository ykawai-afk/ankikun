import type { DeepDive } from "@/lib/types";

export type RootCard = {
  id: string;
  word: string;
  deep_dive: DeepDive | null;
  interval_days: number;
  status: string;
};

export type RootGroup = {
  segment: string; // canonical (lowercase, trimmed) — URL slug + Map key
  display: string; // original-case first-seen segment for UI
  origin: string | null;
  meaning: string; // first-seen meaning, used as tooltip/description
  cards: RootCard[];
};

// Normalise a root segment for grouping. Cards may have slightly different
// casing or whitespace around the same root (`Duc` / `duc` / ` duc `); we
// fold everything to lowercase + trimmed so "duc" / "Duc" collapse together.
export function canonicalSegment(seg: string): string {
  return seg.toLowerCase().trim();
}

// True for segments that are plain affixes (prefix like `re-` or suffix
// like `-ion`, `-ate`). These group every morphologically similar word
// together (e.g. 68 cards under `-ion`) and dilute the etymology-family
// value of root review. Only meaningful stems (`duc`, `spec`, `vert`…)
// survive this filter. Notation: a segment marked with a leading or
// trailing hyphen in the deep_dive output is the linguistic convention
// for affixes.
export function isEtymologicalStem(seg: string): boolean {
  const s = canonicalSegment(seg);
  if (!s) return false;
  if (s.startsWith("-") || s.endsWith("-")) return false;
  // Single-character segments are almost always noise (stray letter).
  if (s.length < 2) return false;
  return true;
}

// Given a set of cards with deep_dive populated, group them by root
// segment. A single card can appear in multiple groups if it has multiple
// roots (prefix + stem + suffix). Returns only groups with ≥2 members,
// sorted by member count descending.
export function groupCardsByRoot(cards: RootCard[]): RootGroup[] {
  const map = new Map<string, RootGroup>();
  for (const c of cards) {
    if (!c.deep_dive) continue;
    for (const r of c.deep_dive.roots) {
      if (!isEtymologicalStem(r.segment)) continue;
      const seg = canonicalSegment(r.segment);
      let g = map.get(seg);
      if (!g) {
        g = {
          segment: seg,
          display: r.segment.trim(),
          origin: r.origin,
          meaning: r.meaning,
          cards: [],
        };
        map.set(seg, g);
      }
      g.cards.push(c);
    }
  }
  return [...map.values()]
    .filter((g) => g.cards.length >= 2)
    .sort((a, b) => b.cards.length - a.cards.length);
}
