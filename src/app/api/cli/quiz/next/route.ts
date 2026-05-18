import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "../../_lib";

export const runtime = "nodejs";

// GET /api/cli/quiz/next?count=3&card_type=word
// Pulls the next-due cards for the brainstorming-side quiz. Prefers
// "review" cards (highest learning leverage) then "learning" then "new".
// Returns the minimal payload needed to show a card in chat plus the
// audio_url for macOS `say` playback.
export async function GET(req: NextRequest) {
  const a = requireAuth(req);
  if (!a.ok) return a.res;
  const userId = a.userId;

  const url = new URL(req.url);
  const countRaw = Number(url.searchParams.get("count") ?? "3");
  const count = Number.isFinite(countRaw)
    ? Math.max(1, Math.min(20, Math.floor(countRaw)))
    : 3;
  const cardType = url.searchParams.get("card_type"); // "word" | "expression" | null

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  let q = supabase
    .from("cards")
    .select(
      "id, card_type, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, audio_url, difficulty, curriculum_source, derivation_type, family_pack_id, status, repetitions, interval_days, ease_factor, next_review_at"
    )
    .eq("user_id", userId)
    .neq("status", "suspended")
    .lte("next_review_at", nowIso)
    .order("next_review_at", { ascending: true })
    .limit(count);
  if (cardType === "word" || cardType === "expression") {
    q = q.eq("card_type", cardType);
  }

  const { data: due, error: dueErr } = await q;
  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  let cards = due ?? [];
  if (cards.length < count) {
    let nq = supabase
      .from("cards")
      .select(
        "id, card_type, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, audio_url, difficulty, curriculum_source, derivation_type, family_pack_id, status, repetitions, interval_days, ease_factor, next_review_at"
      )
      .eq("user_id", userId)
      .eq("status", "new")
      .order("created_at", { ascending: true })
      .limit(count - cards.length);
    if (cardType === "word" || cardType === "expression") {
      nq = nq.eq("card_type", cardType);
    }
    const { data: news } = await nq;
    if (news) cards = [...cards, ...news];
  }

  return NextResponse.json({ cards, fetched: cards.length });
}
