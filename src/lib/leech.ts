import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW = 5;
const THRESHOLD = 3;
// Supabase returns the real as a JS number; use a small epsilon above the 1.3
// floor so natural rounding doesn't miss cards that have truly bottomed out.
const EASE_FLOOR_THRESHOLD = 1.35;

type LogRow = { card_id: string; rating: number };

async function getLeechCardIdsFromLogs(userId: string): Promise<{ id: string; score: number }[]> {
  const supabase = createAdminClient();
  const { data: logs } = await supabase
    .from("review_logs")
    .select("card_id, rating")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(5000);

  const byCard = new Map<string, number[]>();
  for (const l of (logs ?? []) as LogRow[]) {
    const arr = byCard.get(l.card_id) ?? [];
    if (arr.length < WINDOW) {
      arr.push(l.rating);
      byCard.set(l.card_id, arr);
    }
  }

  const leech: { id: string; score: number }[] = [];
  for (const [id, ratings] of byCard) {
    if (ratings.length < THRESHOLD) continue;
    const again = ratings.filter((r) => r === 0).length;
    if (again >= THRESHOLD) leech.push({ id, score: again });
  }
  return leech;
}

async function getEaseFloorCardIds(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("cards")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "suspended")
    .lte("ease_factor", EASE_FLOOR_THRESHOLD);
  return (data ?? []).map((r) => r.id);
}

async function getCombinedLeechIds(userId: string): Promise<string[]> {
  const [logBased, easeBased] = await Promise.all([
    getLeechCardIdsFromLogs(userId),
    getEaseFloorCardIds(userId),
  ]);
  const scored = new Map<string, number>();
  // +1 per recent Again beyond threshold
  for (const { id, score } of logBased) scored.set(id, score);
  // Ease-floor hit gets a large score so they surface first in leech mode.
  for (const id of easeBased) scored.set(id, (scored.get(id) ?? 0) + 5);
  const ranked = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // Log-based scoring can surface stale IDs whose card was deleted or
  // suspended (review_logs outlive the card row). Intersect with live,
  // non-suspended cards so the home counter and /review/leech queue match.
  if (ranked.length === 0) return ranked;
  const supabase = createAdminClient();
  const { data: live } = await supabase
    .from("cards")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "suspended")
    .in("id", ranked);
  const liveSet = new Set((live ?? []).map((r) => r.id as string));
  return ranked.filter((id) => liveSet.has(id));
}

export async function getLeechCount(userId: string): Promise<number> {
  const ids = await getCombinedLeechIds(userId);
  return ids.length;
}

export async function getLeechCardIds(userId: string): Promise<string[]> {
  return getCombinedLeechIds(userId);
}
