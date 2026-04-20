import { NextRequest, NextResponse } from "next/server";
import { pickMediaType, processIngest, type AllowedMediaType } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const contentType = req.headers.get("content-type") ?? "";
  let bytes: Buffer;
  let mediaType: AllowedMediaType;

  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'multipart field "image" required' },
        { status: 400 }
      );
    }
    bytes = Buffer.from(await file.arrayBuffer());
    mediaType = pickMediaType(file.type || "image/png");
  } else if (contentType.startsWith("application/json")) {
    const body = (await req.json()) as { image_base64?: string; media_type?: string };
    if (!body.image_base64) {
      return NextResponse.json(
        { error: "image_base64 required" },
        { status: 400 }
      );
    }
    bytes = Buffer.from(body.image_base64, "base64");
    mediaType = pickMediaType(body.media_type ?? "image/png");
  } else {
    return NextResponse.json(
      { error: "content-type must be multipart/form-data or application/json" },
      { status: 400 }
    );
  }

  try {
    const result = await processIngest({ bytes, mediaType, userId });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
