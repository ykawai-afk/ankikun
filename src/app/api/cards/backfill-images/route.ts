import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type PexelsSrc = {
  medium?: string;
  small?: string;
  tiny?: string;
};

type PexelsPhoto = {
  id: number;
  src: PexelsSrc;
};

type PexelsSearch = {
  photos?: PexelsPhoto[];
};

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = process.env.INGEST_USER_ID;
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!userId) {
    return NextResponse.json({ error: "INGEST_USER_ID not set" }, { status: 500 });
  }
  if (!pexelsKey) {
    return NextResponse.json(
      { error: "PEXELS_API_KEY not set (add to Vercel env)" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 200);

  const supabase = createAdminClient();
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, word")
    .eq("user_id", userId)
    .is("image_url", null)
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cards?.length) return NextResponse.json({ updated: 0, remaining: 0 });

  let updated = 0;
  const failures: string[] = [];
  const CONCURRENCY = 4;

  async function fetchOne(card: { id: string; word: string }) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(card.word)}&per_page=1&orientation=landscape`;
      const res = await fetch(url, {
        headers: { Authorization: pexelsKey! },
        cache: "no-store",
      });
      if (!res.ok) {
        failures.push(`${card.word}: http ${res.status}`);
        return;
      }
      const data = (await res.json()) as PexelsSearch;
      const src = data.photos?.[0]?.src;
      const imageUrl = src?.medium ?? src?.small ?? src?.tiny ?? null;
      // Always set (even null as empty string) so retries don't loop forever
      const value = imageUrl ?? "";
      const { error: upd } = await supabase
        .from("cards")
        .update({ image_url: value || null })
        .eq("id", card.id)
        .eq("user_id", userId);
      if (upd) {
        failures.push(`${card.word}: ${upd.message}`);
      } else if (imageUrl) {
        updated++;
      }
    } catch (err) {
      failures.push(
        `${card.word}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const queueCards = cards;
  let i = 0;
  async function worker() {
    while (i < queueCards.length) {
      const idx = i++;
      await fetchOne(queueCards[idx]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const { count: remaining } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("image_url", null);

  return NextResponse.json({
    processed: cards.length,
    updated,
    remaining: remaining ?? 0,
    failures: failures.slice(0, 5),
  });
}
