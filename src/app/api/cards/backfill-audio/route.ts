import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWordAudio } from "@/lib/dictionary";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "INGEST_USER_ID not set" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
    force?: boolean;
  };
  const force = body.force === true;
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 500);

  const supabase = createAdminClient();
  const query = supabase
    .from("cards")
    .select("id, word")
    .eq("user_id", userId)
    .neq("status", "suspended")
    .limit(limit);
  if (!force) query.is("audio_url", null);
  const { data: cards, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!cards?.length) {
    return NextResponse.json({ processed: 0, updated: 0, remaining: 0 });
  }

  // Look up each word in parallel but gated — Free Dictionary API doesn't
  // publish rate limits, so we cap concurrency at 6 to stay polite.
  const CONCURRENCY = 6;
  let i = 0;
  let updated = 0;
  let miss = 0;
  const misses: string[] = [];

  async function worker() {
    while (i < cards!.length) {
      const idx = i++;
      const card = cards![idx];
      const url = await fetchWordAudio(card.word);
      if (!url) {
        miss++;
        if (misses.length < 10) misses.push(card.word);
        // Record an empty string sentinel so force=false runs don't repeatedly
        // retry the same misses. force=true still overwrites.
        await supabase
          .from("cards")
          .update({ audio_url: "" })
          .eq("id", card.id)
          .eq("user_id", userId);
        continue;
      }
      const { error: upd } = await supabase
        .from("cards")
        .update({ audio_url: url })
        .eq("id", card.id)
        .eq("user_id", userId);
      if (!upd) updated++;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, cards.length) }, () => worker())
  );

  const { count: remaining } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("audio_url", null);

  return NextResponse.json({
    processed: cards.length,
    updated,
    miss,
    miss_samples: misses,
    remaining: remaining ?? 0,
  });
}
