import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 10;

// Inverted L4: returns the user's recently-starred expression cards as a
// "comfort zone" feed for the floating app to pass through to Haiku as
// AVOID context. Defaults to 25 most-recent — large enough to anchor the
// user's voice, small enough to keep the prompt cheap.
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.INGEST_TOKEN}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "INGEST_USER_ID not configured" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(limitParam) || DEFAULT_LIMIT)
  );

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cards")
    .select("word, created_at")
    .eq("user_id", userId)
    .eq("card_type", "expression")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    expressions: (data ?? []).map((r) => r.word),
  });
}
