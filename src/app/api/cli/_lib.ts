import { NextRequest, NextResponse } from "next/server";

// Shared helpers for /api/cli/* routes. These routes are consumed by the
// Claude Code brainstorming session (token-authenticated) to keep the
// daily learning loop in sync with the Next.js app.

export function requireAuth(req: NextRequest):
  | { ok: true; userId: string }
  | { ok: false; res: NextResponse } {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.INGEST_TOKEN}`;
  if (!auth || auth !== expected) {
    return {
      ok: false,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const userId = process.env.INGEST_USER_ID;
  if (!userId) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "INGEST_USER_ID not configured" },
        { status: 500 }
      ),
    };
  }
  return { ok: true, userId };
}

export function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

export function n(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

export function strArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const arr = v
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0);
  return arr.length > 0 ? arr : null;
}
