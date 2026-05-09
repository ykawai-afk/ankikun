import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

// English completion / Japanese translation endpoint for the floating
// "eikun" desktop app. Two modes:
//   - complete: user is mid-sentence in English, hit Tab; produce 3
//     candidate completions to next sentence boundary.
//   - translate: user is stuck and dropped into 日本語逃げモード;
//     translate the Japanese into 3 natural English candidates.
// Inverted L4: the user's `avoidList` (recently-starred expressions) is
// passed as "you've used these N times each — propose alternatives" so
// suggestions push toward unfamiliar register, not echo their voice.

const RequestSchema = z.object({
  mode: z.enum(["complete", "translate"]),
  draft: z.string().optional(),
  japanese: z.string().optional(),
  modeHint: z.string().optional(),
  contextText: z.string().optional(),
  sessionContext: z.string().optional(),
  avoidList: z.array(z.string()).optional(),
});

const CandidateSchema = z.object({
  text: z.string(),
  register: z
    .enum(["casual", "neutral", "formal", "idiomatic", "technical"])
    .nullable(),
  isStretch: z.boolean(),
});

const ResponseSchema = z.object({
  candidates: z.array(CandidateSchema).length(3),
});

function buildSystemPrompt(): string {
  return `You are an English production coach for a Japanese engineer who uses Claude Code daily and is targeting C1.

Core rules:
- Produce English the user could plausibly send/type in their actual workflow (PR comments, Slack to teammates, Claude Code prompts, technical docs). Default register: technical, concise, action-oriented.
- Always return exactly 3 candidates. At least one MUST be marked isStretch=true: a phrasing the user is unlikely to have produced themselves (more idiomatic, more native-sounding, or stylistically richer than their typical voice).
- The user's "voice" (avoidList) is the comfort zone. Treat it as territory the user has already covered — propose alternatives that genuinely expand their range, not echoes of what they already use.
- Be honest if the draft has an error: the candidates can correct it silently.
- No filler ("Sure thing!", "Here you go", etc.). Output is the message itself.
- For complete mode: continue from the cursor naturally to the next sentence boundary, preserving the user's existing wording. Don't restart the sentence.
- For translate mode: produce English the user's draft Japanese maps to in this technical context.`;
}

function buildUserPrompt(input: z.infer<typeof RequestSchema>): string {
  const lines: string[] = [];

  lines.push(`Mode: ${input.mode}`);
  lines.push(`Context hint: ${input.modeHint ?? "prompt to Claude Code (technical, concise)"}`);

  if (input.avoidList && input.avoidList.length > 0) {
    lines.push("");
    lines.push("User's recent comfort-zone phrasings (AVOID echoing — propose fresh alternatives):");
    for (const a of input.avoidList.slice(0, 25)) {
      lines.push(`- ${a}`);
    }
  }

  if (input.contextText) {
    lines.push("");
    lines.push("Situation / pasted context (what the user is responding to):");
    lines.push(input.contextText.slice(0, 3000));
  }

  if (input.sessionContext) {
    lines.push("");
    lines.push("Recent Claude Code activity in current session:");
    lines.push(input.sessionContext.slice(0, 3000));
  }

  lines.push("");
  if (input.mode === "complete") {
    lines.push("User's English draft so far (cursor at end):");
    lines.push("```");
    lines.push(input.draft ?? "");
    lines.push("```");
    lines.push("");
    lines.push("Produce 3 candidate completions to the next sentence boundary, preserving what the user has already typed. Mark exactly one as isStretch (more native/idiomatic than the user's typical voice).");
  } else {
    lines.push("User got stuck and dropped to Japanese. Translate this into 3 English candidates the user can pick from:");
    lines.push("```");
    lines.push(input.japanese ?? "");
    lines.push("```");
    lines.push("");
    lines.push("Mark exactly one candidate as isStretch (more natural/idiomatic than literal translation).");
  }

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.INGEST_TOKEN}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof RequestSchema>;
  try {
    const body = await req.json();
    parsed = RequestSchema.parse(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (parsed.mode === "complete" && !parsed.draft?.trim()) {
    return NextResponse.json(
      { error: "complete mode requires a non-empty draft" },
      { status: 400 }
    );
  }
  if (parsed.mode === "translate" && !parsed.japanese?.trim()) {
    return NextResponse.json(
      { error: "translate mode requires japanese text" },
      { status: 400 }
    );
  }

  const client = getAnthropicClient();

  try {
    const result = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(parsed),
        },
      ],
      output_config: { format: zodOutputFormat(ResponseSchema) },
    });

    const parsedOutput = result.parsed_output;
    if (!parsedOutput) {
      return NextResponse.json(
        { error: "model returned no parsed output" },
        { status: 502 }
      );
    }
    return NextResponse.json(parsedOutput);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
