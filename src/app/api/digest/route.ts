import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily harvest endpoint: takes a chunk of the user's actual English
// (typically scraped from today's Claude Code session JSONL files by
// the eikun CLI) and lets Haiku 4.5 do two passes:
//   1. Surface only the expressions worth memorizing — skip trivial
//      utterances, code strings, throwaway acks, and anything already
//      in the user's avoid list.
//   2. Naturally correct anything awkward / non-native, presenting the
//      polished form as the card's `expression` and the user's actual
//      attempt (when corrected) as part of the `note` so the SRS
//      review surfaces the learning moment.
// The endpoint inserts the keepers into the expression lane and
// returns a structured summary so the CLI can show what was added.

const RequestSchema = z.object({
  text: z.string().min(1).max(60000),
  since: z.string().optional(),
});

const HarvestedSchema = z.object({
  expression: z
    .string()
    .min(2)
    .max(400)
    .describe(
      "The natural English form, corrected if the user's version was awkward."
    ),
  note: z
    .string()
    .min(2)
    .max(400)
    .describe(
      "Japanese situational cue describing when this expression is used. If you corrected the user's attempt, include their original phrasing here so the SRS review surfaces the lesson (e.g., '場面: ... / 自分の出力: <user's version>')."
    ),
  was_correction: z
    .boolean()
    .describe(
      "True if you adjusted grammar/naturalness; false if the user's English was already idiomatic."
    ),
  user_original: z
    .string()
    .nullable()
    .describe(
      "The user's original phrasing when corrected; null when no correction was needed."
    ),
});

const ResponseSchema = z.object({
  expressions: z
    .array(HarvestedSchema)
    .max(25)
    .describe(
      "Between 0 and 25 expressions worth memorizing. Empty array is valid when the input had no learning value."
    ),
});

function buildSystemPrompt(): string {
  return `You are reviewing a Japanese software engineer's actual English output from today's Claude Code conversations. They are targeting C1 and want to harvest learning moments from their working day.

Pick 0-25 expressions worth memorizing as anki cards. For each:
- expression: the natural English form. If the user's wording was awkward, ungrammatical, or non-native, silently fix it — the card is what they should have produced.
- note: a Japanese situational cue (one short sentence describing 場面/相手/intent). If you corrected the user, append "/ 自分の出力: <their original>" so the SRS surfaces their actual attempt.
- was_correction / user_original: true + their original phrasing when you corrected; false + null when their English was already idiomatic.

SKIP (do not include):
- Trivial utterances: "yes", "ok", "go ahead", "thanks", "got it", "perfect"
- Pure code, file paths, identifiers, error messages
- Single nouns or topic labels with no sentence-level value
- Anything materially identical to a phrase in the user's existing comfort zone (avoid list — passed below)
- Phrases tied to ephemeral context (specific filenames, one-off task names)
- The same idea twice — pick the most teachable instance

PREFER:
- Expressions where the user's intent was clear but the phrasing could be more native
- Idiomatic patterns the user produced naturally — confirms they're in their range, worth reinforcing
- Reasoning / explanation patterns ("the trade-off here is", "I'd push back on that because", "let's pin this down before")
- Useful business / collaboration register the user could reuse

Output language for note: Japanese.
Output language for expression: English (US default).
Empty array is acceptable if nothing in the input clears the bar.`;
}

function buildUserPrompt(text: string, avoidList: string[]): string {
  const lines: string[] = [];
  if (avoidList.length > 0) {
    lines.push(
      "Avoid list (user already has these in their deck — skip materially identical phrases):"
    );
    for (const a of avoidList.slice(0, 50)) {
      lines.push(`- ${a}`);
    }
    lines.push("");
  }
  lines.push("Today's English output from Claude Code conversations:");
  lines.push("```");
  lines.push(text.slice(0, 50000));
  lines.push("```");
  return lines.join("\n");
}

async function fetchAvoidList(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("cards")
    .select("word")
    .eq("user_id", userId)
    .eq("card_type", "expression")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => r.word);
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

  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(await req.json());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const avoidList = await fetchAvoidList(userId);
  const client = getAnthropicClient();

  let result;
  try {
    result = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(parsed.text, avoidList),
        },
      ],
      output_config: { format: zodOutputFormat(ResponseSchema) },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const harvested = result.parsed_output?.expressions ?? [];
  if (harvested.length === 0) {
    return NextResponse.json({
      added: 0,
      skipped: 0,
      expressions: [],
    });
  }

  // Insert each. The (user_id, card_type, lower(word)) unique index
  // catches anything Haiku missed in dedup, so the avoid list isn't a
  // hard contract — duplicates just count as `skipped` and don't
  // pollute the queue.
  const supabase = createAdminClient();
  const inserts = harvested.map((h) => ({
    user_id: userId,
    card_type: "expression" as const,
    word: h.expression.trim(),
    definition_ja: h.note.trim(),
  }));

  const { data: insertedRows, error: insertErr } = await supabase
    .from("cards")
    .insert(inserts)
    .select("id, word")
    .returns<Array<{ id: string; word: string }>>();

  // If a bulk insert fails on any unique violation, Postgres rolls back
  // the entire batch by default. Fall back to row-by-row inserts so a
  // single dup doesn't lose the whole harvest.
  let added = 0;
  let skipped = 0;
  const addedExpressions: typeof harvested = [];
  if (insertErr) {
    for (let i = 0; i < inserts.length; i++) {
      const row = inserts[i];
      const { error } = await supabase
        .from("cards")
        .insert(row)
        .select("id")
        .single();
      if (!error) {
        added++;
        addedExpressions.push(harvested[i]);
      } else if (error.code === "23505") {
        skipped++;
      }
    }
  } else {
    added = insertedRows?.length ?? 0;
    skipped = harvested.length - added;
    addedExpressions.push(...harvested.slice(0, added));
  }

  revalidatePath("/");
  revalidatePath("/review/expression");
  revalidateTag(CACHE_TAGS.cards);

  return NextResponse.json({
    added,
    skipped,
    expressions: addedExpressions,
  });
}
