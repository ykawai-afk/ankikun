import { createAdminClient } from "@/lib/supabase/admin";

// Cap on how many unused freezes pile up. Without a cap, long off-app
// absences would bank a huge reserve and render the streak meaningless.
// Two is enough to cover an occasional rough week without negating the
// "don't break the chain" pressure.
export const MAX_FREEZES = 2;
const REFILL_INTERVAL_DAYS = 7;

export type UserState = {
  user_id: string;
  streak_freezes_available: number;
  last_freeze_refill_at: string | null;
};

// Idempotent weekly refill. Called lazily on home page load. Advances
// last_freeze_refill_at in whole-week increments so there's no drift:
// missing the app for 3 weeks adds 3 weeks' worth (capped at MAX_FREEZES).
export async function loadUserStateWithRefill(userId: string): Promise<UserState> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("user_state")
    .select("user_id, streak_freezes_available, last_freeze_refill_at")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date();
  if (!existing) {
    const row: UserState = {
      user_id: userId,
      streak_freezes_available: 1,
      last_freeze_refill_at: now.toISOString(),
    };
    await supabase.from("user_state").insert(row);
    return row;
  }

  if (!existing.last_freeze_refill_at) {
    await supabase
      .from("user_state")
      .update({ last_freeze_refill_at: now.toISOString() })
      .eq("user_id", userId);
    return { ...existing, last_freeze_refill_at: now.toISOString() };
  }

  const lastRefill = new Date(existing.last_freeze_refill_at);
  const weeksElapsed = Math.floor(
    (now.getTime() - lastRefill.getTime()) /
      (REFILL_INTERVAL_DAYS * 86_400_000)
  );
  if (weeksElapsed <= 0) return existing;

  const added = Math.min(
    weeksElapsed,
    MAX_FREEZES - existing.streak_freezes_available
  );
  const nextAvailable = Math.min(
    MAX_FREEZES,
    existing.streak_freezes_available + added
  );
  const nextRefillAnchor = new Date(
    lastRefill.getTime() + weeksElapsed * REFILL_INTERVAL_DAYS * 86_400_000
  );
  await supabase
    .from("user_state")
    .update({
      streak_freezes_available: nextAvailable,
      last_freeze_refill_at: nextRefillAnchor.toISOString(),
    })
    .eq("user_id", userId);
  return {
    ...existing,
    streak_freezes_available: nextAvailable,
    last_freeze_refill_at: nextRefillAnchor.toISOString(),
  };
}

export async function loadFrozenDays(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("frozen_days")
    .select("day")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.day as string);
}
