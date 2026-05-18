import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "../../_lib";

export const runtime = "nodejs";

// GET /api/cli/quiz/next?count=3&card_type=word
// Pulls the next-due cards for the brainstorming-side quiz. Prefers
// "review" cards (highest learning leverage) then "learning" then "new".
//
// For expression cards, only chat-organic (curriculum_source = "chat-
// organic") gets surfaced — the bulk-imported curriculum phrases sit in
// /review/typing for production drill and shouldn't crowd the chat
// quiz, which is meant to recycle what the user actually used in this
// or a recent Claude Code session.
const CARD_COLUMNS =
  "id, card_type, word, reading, part_of_speech, definition_ja, definition_en, example_en, example_ja, audio_url, difficulty, curriculum_source, derivation_type, family_pack_id, status, repetitions, interval_days, ease_factor, next_review_at";

const CHAT_FILTER =
  "card_type.eq.word,and(card_type.eq.expression,curriculum_source.eq.chat-organic)";

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

  let dueQuery = supabase
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "suspended")
    .lte("next_review_at", nowIso)
    .order("next_review_at", { ascending: true })
    .limit(count);
  if (cardType === "word") {
    dueQuery = dueQuery.eq("card_type", "word");
  } else if (cardType === "expression") {
    dueQuery = dueQuery
      .eq("card_type", "expression")
      .eq("curriculum_source", "chat-organic");
  } else {
    dueQuery = dueQuery.or(CHAT_FILTER);
  }

  const { data: due, error: dueErr } = await dueQuery;
  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  let cards = due ?? [];
  if (cards.length < count) {
    let newQuery = supabase
      .from("cards")
      .select(CARD_COLUMNS)
      .eq("user_id", userId)
      .eq("status", "new")
      .order("created_at", { ascending: true })
      .limit(count - cards.length);
    if (cardType === "word") {
      newQuery = newQuery.eq("card_type", "word");
    } else if (cardType === "expression") {
      newQuery = newQuery
        .eq("card_type", "expression")
        .eq("curriculum_source", "chat-organic");
    } else {
      newQuery = newQuery.or(CHAT_FILTER);
    }
    const { data: news } = await newQuery;
    if (news) cards = [...cards, ...news];
  }

  return NextResponse.json({ cards, fetched: cards.length });
}
