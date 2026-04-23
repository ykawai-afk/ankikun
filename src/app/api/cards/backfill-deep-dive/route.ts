import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDeepDive } from "@/lib/deep-dive";

export const runtime = "nodejs";
export const maxDuration = 300;

// Number of deep-dive generations in flight at once. Each Sonnet call is
// a few seconds; 20 lets us clear ~200-300 cards per invocation comfortably
// under the 300s maxDuration.
const CONCURRENCY = 20;

export async function POST(req: NextRequest) {
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

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 300, 1), 500);

  const supabase = createAdminClient();
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja, etymology")
    .eq("user_id", userId)
    .is("deep_dive", null)
    .order("interval_days", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cards || cards.length === 0) {
    return NextResponse.json({ updated: 0, remaining: 0 });
  }

  let updated = 0;
  const failures: string[] = [];

  // Fixed-width worker pool so we don't blast 500 Sonnet calls at once.
  let cursor = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= cards.length) return;
      const c = cards[i];
      const dd = await generateDeepDive(c);
      if (!dd) {
        failures.push(c.word);
        continue;
      }
      const { error: updErr } = await supabase
        .from("cards")
        .update({ deep_dive: dd })
        .eq("id", c.id);
      if (updErr) failures.push(c.word);
      else updated++;
    }
  });
  await Promise.all(workers);

  const { count: remaining } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deep_dive", null);

  return NextResponse.json({ updated, failures, remaining: remaining ?? 0 });
}
