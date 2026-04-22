"use server";

import { revalidatePath, updateTag } from "next/cache";
import { pickMediaType, processIngest, processUrlIngest } from "@/lib/ingest";
import { getUserId } from "@/lib/user";
import { CACHE_TAGS } from "@/lib/cache";

export type AddResult =
  | { ok: true; cardsCreated: number; words: string[] }
  | { ok: false; error: string };

export async function addFromImage(formData: FormData): Promise<AddResult> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "画像が選択されていません" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "画像サイズは10MB以下にしてください" };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mediaType = pickMediaType(file.type || "image/png");
  const userId = getUserId();

  try {
    const result = await processIngest({ bytes, mediaType, userId });
    revalidatePath("/");
    revalidatePath("/cards");
    updateTag(CACHE_TAGS.cards);
    return {
      ok: true,
      cardsCreated: result.cards_created,
      words: result.words,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function addFromUrl(formData: FormData): Promise<AddResult> {
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { ok: false, error: "URLを入力してください" };

  const userId = getUserId();
  try {
    const result = await processUrlIngest({ url, userId });
    revalidatePath("/");
    revalidatePath("/cards");
    updateTag(CACHE_TAGS.cards);
    return {
      ok: true,
      cardsCreated: result.cards_created,
      words: result.words,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
