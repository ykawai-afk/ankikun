"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";

// Spend one streak freeze on a specific day (yyyy-mm-dd, JST). Marks the
// day as "frozen" so the streak calculation treats it as covered even if
// no review_logs exist for it. Idempotent on `day`: re-freezing the same
// day is a no-op (PK on frozen_days prevents duplicates).
export async function redeemStreakFreeze(
  day: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, error: "invalid day format" };
  }
  const supabase = createAdminClient();
  const userId = getUserId();

  // Serialise check-and-decrement through a single query. Supabase JS
  // doesn't expose CTEs directly so we do it in two steps: confirm
  // balance > 0, then decrement + insert, rolling back the decrement if
  // the insert fails (usually because the day was already frozen).
  const { data: state, error: readErr } = await supabase
    .from("user_state")
    .select("streak_freezes_available")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!state || state.streak_freezes_available <= 0) {
    return { ok: false, error: "no freezes available" };
  }

  const { error: decErr } = await supabase
    .from("user_state")
    .update({
      streak_freezes_available: state.streak_freezes_available - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("streak_freezes_available", state.streak_freezes_available);
  if (decErr) return { ok: false, error: decErr.message };

  const { error: insErr } = await supabase
    .from("frozen_days")
    .insert({ user_id: userId, day });
  if (insErr) {
    // Rollback the decrement. Best-effort — if this also fails the user
    // is down a freeze with no frozen day, which is fine to absorb for a
    // rare race (they can retry).
    await supabase
      .from("user_state")
      .update({
        streak_freezes_available: state.streak_freezes_available,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return { ok: false, error: insErr.message };
  }

  revalidatePath("/");
  return { ok: true };
}
