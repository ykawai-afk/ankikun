import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "../_lib";

export const runtime = "nodejs";

// GET /api/cli/today
// Snapshot used by the Claude Code session opener: how many cards are due,
// how many new cards are still available to introduce, and recent counters
// that motivate the upcoming session.
export async function GET(req: NextRequest) {
  const a = requireAuth(req);
  if (!a.ok) return a.res;
  const userId = a.userId;

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const [dueWord, dueExpr, newCount, totalActive, recentAdds] =
    await Promise.all([
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("card_type", "word")
        .neq("status", "suspended")
        .lte("next_review_at", nowIso),
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("card_type", "expression")
        .neq("status", "suspended")
        .lte("next_review_at", nowIso),
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "new"),
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .neq("status", "suspended"),
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
    ]);

  return NextResponse.json({
    due: {
      word: dueWord.count ?? 0,
      expression: dueExpr.count ?? 0,
    },
    new_available: newCount.count ?? 0,
    total_active: totalActive.count ?? 0,
    added_last_24h: recentAdds.count ?? 0,
    now: nowIso,
  });
}
