import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW = 5;
const THRESHOLD = 3;

type LogRow = { card_id: string; rating: number };

async function getLeechCardIdsFromLogs(userId: string): Promise<string[]> {
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
  leech.sort((a, b) => b.score - a.score);
  return leech.map((l) => l.id);
}

export async function getLeechCount(userId: string): Promise<number> {
  const ids = await getLeechCardIdsFromLogs(userId);
  return ids.length;
}

export async function getLeechCardIds(userId: string): Promise<string[]> {
  return getLeechCardIdsFromLogs(userId);
}
