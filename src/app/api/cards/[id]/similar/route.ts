import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { embedText, textForEmbedding } from "@/lib/embeddings";

export const runtime = "nodejs";
export const maxDuration = 30;

type SimilarCard = {
  id: string;
  word: string;
  definition_ja: string;
  part_of_speech: string | null;
  reading: string | null;
  similarity: number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();
  const supabase = createAdminClient();

  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .select("id, word, part_of_speech, definition_ja, definition_en, embedding")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (cardErr || !card) {
    return NextResponse.json({ error: "card not found" }, { status: 404 });
  }

  let queryEmbedding = card.embedding as unknown as number[] | null;
  if (!queryEmbedding) {
    try {
      queryEmbedding = await embedText(textForEmbedding(card));
      await supabase
        .from("cards")
        .update({ embedding: queryEmbedding })
        .eq("id", card.id)
        .eq("user_id", userId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 502 }
      );
    }
  }

  const { data: matches, error: rpcErr } = await supabase.rpc(
    "match_similar_cards",
    {
      target_user_id: userId,
      query_embedding: queryEmbedding,
      exclude_card_id: id,
      match_count: 3,
    }
  );

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  return NextResponse.json({ similar: (matches ?? []) as SimilarCard[] });
}
