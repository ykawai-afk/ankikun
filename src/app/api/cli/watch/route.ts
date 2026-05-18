import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "../_lib";

export const runtime = "nodejs";

// GET /api/cli/watch?limit=200
// Returns the active set of words/phrases the brainstorming side should
// watch for in user messages. A match triggers /api/cli/wild-use.
//
// "Active" = status in (new, learning, review), not yet graduated.
// Capped so the Claude Code memory file stays small.
export async function GET(req: NextRequest) {
  const a = requireAuth(req);
  if (!a.ok) return a.res;
  const userId = a.userId;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(10, Math.min(1000, Math.floor(limitRaw)))
    : 200;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cards")
    .select("id, word, card_type, wild_uses_count, status")
    .eq("user_id", userId)
    .in("status", ["new", "learning", "review"])
    .order("last_reviewed_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    watch: data ?? [],
    fetched: data?.length ?? 0,
  });
}
