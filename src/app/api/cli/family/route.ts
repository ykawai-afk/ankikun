import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, s, strArray } from "../_lib";

export const runtime = "nodejs";

// POST /api/cli/family
// Body:
//   {
//     pack_name: "articulate family",
//     description?: "派生 + cognate + collocations",
//     seed: { word, definition_ja, ... },             // optional
//     members: [
//       { word, definition_ja, derivation_type, ... },
//       ...
//     ]
//   }
//
// Creates one family_packs row and inserts each member as a card linked
// via family_pack_id. The seed card (if provided) is inserted first so we
// can record family_packs.seed_card_id.
type CardLike = {
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
  audio_url?: unknown;
  difficulty?: unknown;
  curriculum_source?: unknown;
  strategic_theme?: unknown;
  derivation_type?: unknown;
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

function rowFromCard(
  c: CardLike,
  userId: string,
  familyPackId: string | null
): Record<string, unknown> | null {
  const word = s(c.word);
  const definition_ja = s(c.definition_ja);
  if (!word || !definition_ja) return null;
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
  const ct = s(c.card_type);
  if (ct && CARD_TYPES.has(ct)) row.card_type = ct;
  const ety = s(c.etymology);
  if (ety) row.etymology = ety;
  const ctx = s(c.source_context);
  if (ctx) row.source_context = ctx;
  const audio = s(c.audio_url);
  if (audio) row.audio_url = audio;
  const diff = s(c.difficulty);
  if (diff && CEFR.has(diff)) row.difficulty = diff;
  const cur = s(c.curriculum_source);
  if (cur) row.curriculum_source = cur;
  const theme = s(c.strategic_theme);
  if (theme) row.strategic_theme = theme;
  const deriv = s(c.derivation_type);
  if (deriv && DERIVATIONS.has(deriv)) row.derivation_type = deriv;
  const tags = strArray(c.tags);
  if (tags) row.tags = tags;
  if (familyPackId) row.family_pack_id = familyPackId;
  return row;
}

export async function POST(req: NextRequest) {
  const a = requireAuth(req);
  if (!a.ok) return a.res;
  const userId = a.userId;

  let body: {
    pack_name?: unknown;
    description?: unknown;
    seed?: CardLike;
    members?: CardLike[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const packName = s(body.pack_name);
  if (!packName) {
    return NextResponse.json({ error: "pack_name required" }, { status: 400 });
  }
  const description = s(body.description);
  const members = Array.isArray(body.members) ? body.members : [];
  if (members.length === 0 && !body.seed) {
    return NextResponse.json(
      { error: "seed or members required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Insert family pack shell first (no seed_card_id yet). Only include
  // description when present so PostgREST schema-cache hiccups on the
  // optional column don't block the insert.
  const packInsert: Record<string, unknown> = {
    user_id: userId,
    pack_name: packName,
  };
  if (description) packInsert.description = description;
  const { data: pack, error: packErr } = await supabase
    .from("family_packs")
    .insert(packInsert)
    .select("id")
    .single();
  if (packErr || !pack) {
    return NextResponse.json(
      { error: packErr?.message ?? "failed to create pack" },
      { status: 500 }
    );
  }
  const packId = pack.id as string;

  let seedCardId: string | null = null;

  if (body.seed) {
    const seedRow = rowFromCard(body.seed, userId, packId);
    if (seedRow) {
      const { data: seed, error: seedErr } = await supabase
        .from("cards")
        .insert(seedRow)
        .select("id")
        .single();
      if (seedErr) {
        return NextResponse.json(
          { error: `seed insert failed: ${seedErr.message}` },
          { status: 500 }
        );
      }
      seedCardId = seed.id as string;
      await supabase
        .from("family_packs")
        .update({ seed_card_id: seedCardId })
        .eq("id", packId);
    }
  }

  let memberCount = 0;
  if (members.length > 0) {
    const rows = members
      .map((m) => rowFromCard(m, userId, packId))
      .filter((r): r is Record<string, unknown> => r !== null);
    if (rows.length > 0) {
      const { error: memberErr } = await supabase.from("cards").insert(rows);
      if (memberErr) {
        return NextResponse.json(
          {
            error: `member insert failed: ${memberErr.message}`,
            pack_id: packId,
            seed_card_id: seedCardId,
          },
          { status: 500 }
        );
      }
      memberCount = rows.length;
    }
  }

  return NextResponse.json({
    pack_id: packId,
    seed_card_id: seedCardId,
    members_inserted: memberCount,
  });
}
