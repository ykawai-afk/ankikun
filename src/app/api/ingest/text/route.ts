import { NextRequest, NextResponse } from "next/server";
import { processTextIngest } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

// Target audience: the bookmarklet on /bookmarklet, which fires cross-origin
// from any page the user is reading. CORS: allow arbitrary origin so the
// browser accepts the response — the INGEST_TOKEN gates the actual work.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }
  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "INGEST_USER_ID not set" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    source_url?: string;
    title?: string;
  };
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json(
      { error: "text required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await processTextIngest({
      text,
      sourceUrl: body.source_url ?? null,
      title: body.title ?? null,
      userId,
    });
    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
