import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Incoming = {
  word?: unknown;
  reading?: unknown;
  part_of_speech?: unknown;
  definition_ja?: unknown;
  definition_en?: unknown;
  example_en?: unknown;
  example_ja?: unknown;
  etymology?: unknown;
  tags?: unknown;
};

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

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

  let body: { cards?: Incoming[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const input = Array.isArray(body.cards) ? body.cards : [];
  if (input.length === 0) {
    return NextResponse.json({ error: "cards array required" }, { status: 400 });
  }
  if (input.length > 2000) {
    return NextResponse.json(
      { error: `too many cards (${input.length} > 2000)` },
      { status: 400 }
    );
  }

  const rows = [] as Array<Record<string, unknown>>;
  for (const c of input) {
    const word = s(c.word);
    const definition_ja = s(c.definition_ja);
    if (!word || !definition_ja) continue;
    const row: Record<string, unknown> = {
      user_id: userId,
      word,
      reading: s(c.reading),
      part_of_speech: s(c.part_of_speech),
      definition_ja,
      definition_en: s(c.definition_en),
      example_en: s(c.example_en),
      example_ja: s(c.example_ja),
    };
    const ety = s(c.etymology);
    if (ety) row.etymology = ety;
    if (Array.isArray(c.tags)) {
      const tagList = c.tags
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0);
      if (tagList.length > 0) row.tags = tagList;
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "no valid rows (word and definition_ja required)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("cards").insert(slice);
    if (error) {
      return NextResponse.json(
        { error: error.message, inserted },
        { status: 500 }
      );
    }
    inserted += slice.length;
  }

  return NextResponse.json({ inserted, skipped: input.length - rows.length });
}
