import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedBatch, textForEmbedding } from "@/lib/embeddings";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 64;

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
  const limit = Math.min(Math.max(body.limit ?? 500, 1), 500);

  const supabase = createAdminClient();
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja, definition_en")
    .eq("user_id", userId)
    .is("embedding", null)
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cards || cards.length === 0) {
    return NextResponse.json({ updated: 0, remaining: 0 });
  }

  let updated = 0;
  const failures: string[] = [];

  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const inputs = batch.map(textForEmbedding);
    try {
      const vectors = await embedBatch(inputs);
      await Promise.all(
        batch.map(async (c, j) => {
          const emb = vectors[j];
          if (!emb) return;
          const { error: upd } = await supabase
            .from("cards")
            .update({ embedding: emb })
            .eq("id", c.id)
            .eq("user_id", userId);
          if (upd) failures.push(`${c.word}: ${upd.message}`);
          else updated++;
        })
      );
    } catch (err) {
      failures.push(
        `batch ${i}-${i + batch.length}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  const { count: remaining } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("embedding", null);

  return NextResponse.json({
    processed: cards.length,
    updated,
    remaining: remaining ?? 0,
    failures: failures.slice(0, 5),
  });
}
