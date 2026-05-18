import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, s } from "../_lib";

export const runtime = "nodejs";

// POST /api/cli/wild-use
// Body: { card_id: string } OR { word: string }
//
// Increments wild_uses_count on the card. Called by the brainstorming
// session whenever the user organically uses a phrase from their active
// deck. Hitting 3+ wild uses is one of the signals we use to graduate a
// card out of daily review pressure.
export async function POST(req: NextRequest) {
  const a = requireAuth(req);
  if (!a.ok) return a.res;
  const userId = a.userId;

  let body: { card_id?: unknown; word?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const cardId = s(body.card_id);
  const word = s(body.word);
  if (!cardId && !word) {
    return NextResponse.json(
      { error: "card_id or word required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let q = supabase
    .from("cards")
    .select("id, word, wild_uses_count")
    .eq("user_id", userId)
    .limit(1);
  if (cardId) q = q.eq("id", cardId);
  else if (word) q = q.eq("word", word);

  const { data: rows, error: fetchErr } = await q;
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  const card = rows?.[0];
  if (!card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  const nextCount = (card.wild_uses_count ?? 0) + 1;
  const { error: upErr } = await supabase
    .from("cards")
    .update({ wild_uses_count: nextCount })
    .eq("id", card.id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    card_id: card.id,
    word: card.word,
    wild_uses_count: nextCount,
    graduation_candidate: nextCount >= 3,
  });
}
