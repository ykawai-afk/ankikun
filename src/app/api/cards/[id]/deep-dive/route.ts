import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { generateDeepDive } from "@/lib/deep-dive";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();
  const supabase = createAdminClient();

  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja, etymology, deep_dive")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (cardErr || !card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { regenerate?: boolean };
  if (!body.regenerate && card.deep_dive) {
    return NextResponse.json({ deep_dive: card.deep_dive });
  }

  const deepDive = await generateDeepDive({
    word: card.word,
    part_of_speech: card.part_of_speech,
    definition_ja: card.definition_ja,
    etymology: card.etymology,
  });

  if (!deepDive) {
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  }

  const { error: updErr } = await supabase
    .from("cards")
    .update({ deep_dive: deepDive })
    .eq("id", id)
    .eq("user_id", userId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ deep_dive: deepDive });
}
