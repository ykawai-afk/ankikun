import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// One-shot-ish admin: adds a tag to cards matched by a filter predicate.
// Used to retroactively tag the Emily in Paris CSV import that was uploaded
// before the CSV script set tags explicitly.
//
// POST /api/cards/backfill-tags
//   body: { tag: string, filter: "untagged_csv", dry_run?: boolean }

type Body = {
  tag?: string;
  filter?: "untagged_csv";
  dry_run?: boolean;
};

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "INGEST_USER_ID not set" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const tag = body.tag?.trim();
  if (!tag) {
    return NextResponse.json({ error: "tag required" }, { status: 400 });
  }
  const filter = body.filter ?? "untagged_csv";
  if (filter !== "untagged_csv") {
    return NextResponse.json({ error: "unknown filter" }, { status: 400 });
  }

  const supabase = createAdminClient();
  // "CSV import with no tag": these cards have no source_image_path (not a
  // screenshot), no source_context (URL ingest would populate it), and no
  // tags (the iCarly import set tags=['iCarly'] so those are excluded).
  const { data: candidates, error } = await supabase
    .from("cards")
    .select("id, word, tags")
    .eq("user_id", userId)
    .is("source_image_path", null)
    .is("source_context", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (candidates ?? []).filter(
    (c) => !c.tags || c.tags.length === 0
  );

  if (body.dry_run) {
    return NextResponse.json({
      dry_run: true,
      would_tag: rows.length,
      sample: rows.slice(0, 10).map((r) => r.word),
    });
  }

  // One bulk update keyed by id list — 499 sequential updates was hitting
  // the 60s serverless ceiling. PostgREST runs this as a single statement.
  const ids = rows.map((r) => r.id);
  const CHUNK = 200;
  let updated = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error: upd } = await supabase
      .from("cards")
      .update({ tags: [tag] })
      .in("id", slice)
      .eq("user_id", userId);
    if (upd) {
      return NextResponse.json(
        { error: upd.message, matched: rows.length, updated },
        { status: 500 }
      );
    }
    updated += slice.length;
  }

  return NextResponse.json({ matched: rows.length, updated });
}
