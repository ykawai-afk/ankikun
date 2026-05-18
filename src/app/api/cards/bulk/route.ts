import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Incoming = {
  card_type?: unknown;
  word?: unknown;
  reading?: unknown;
  part_of_speech?: unknown;
  definition_ja?: unknown;
  definition_en?: unknown;
  example_en?: unknown;
  example_ja?: unknown;
  etymology?: unknown;
  source_context?: unknown;
  user_note?: unknown;
  audio_url?: unknown;
  difficulty?: unknown;
  frequency_rank?: unknown;
  curriculum_source?: unknown;
  strategic_theme?: unknown;
  derivation_type?: unknown;
  family_pack_id?: unknown;
  tags?: unknown;
};

const CARD_TYPES = new Set(["word", "expression"]);
const CEFR = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
const DERIVATIONS = new Set([
  "family",
  "cognate-trap",
  "synonym",
  "antonym",
  "collocation",
]);

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function intInRange(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  if (v < min || v > max) return null;
  return v;
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
      definition_ja,
      reading: s(c.reading),
      part_of_speech: s(c.part_of_speech),
      definition_en: s(c.definition_en),
      example_en: s(c.example_en),
      example_ja: s(c.example_ja),
    };

    const cardType = s(c.card_type);
    if (cardType && CARD_TYPES.has(cardType)) row.card_type = cardType;

    const ety = s(c.etymology);
    if (ety) row.etymology = ety;

    const ctx = s(c.source_context);
    if (ctx) row.source_context = ctx;

    const note = s(c.user_note);
    if (note) row.user_note = note;

    const audio = s(c.audio_url);
    if (audio) row.audio_url = audio;

    const diff = s(c.difficulty);
    if (diff && CEFR.has(diff)) row.difficulty = diff;

    const freq = intInRange(c.frequency_rank, 1, 60000);
    if (freq !== null) row.frequency_rank = freq;

    const cur = s(c.curriculum_source);
    if (cur) row.curriculum_source = cur;

    const theme = s(c.strategic_theme);
    if (theme) row.strategic_theme = theme;

    const deriv = s(c.derivation_type);
    if (deriv && DERIVATIONS.has(deriv)) row.derivation_type = deriv;

    const fp = s(c.family_pack_id);
    if (fp) row.family_pack_id = fp;

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
