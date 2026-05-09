import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 10;

const RequestSchema = z.object({
  expression: z.string().min(1).max(400),
  note: z.string().min(1).max(400),
});

// Floating-app entry point for "I want to remember this expression."
// Inserts an expression-lane card via the same shared schema; the nightly
// review queue picks it up automatically. Idempotent per (user, lower(word))
// thanks to the unique index, so a duplicate Cmd+Enter from the floating
// app surfaces a clean 409 instead of polluting the queue.
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

  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(await req.json());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cards")
    .insert({
      user_id: userId,
      card_type: "expression",
      word: parsed.expression.trim(),
      definition_ja: parsed.note.trim(),
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation: same expression already starred.
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "already starred" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/review/expression");
  revalidateTag(CACHE_TAGS.cards);
  return NextResponse.json({ ok: true, cardId: data?.id });
}
