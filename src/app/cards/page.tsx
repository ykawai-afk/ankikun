import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { PageShell } from "@/components/page-shell";
import { CardsList, type CardRow } from "./cards-list";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const supabase = createAdminClient();
  const userId = getUserId();

  const { data: cards } = await supabase
    .from("cards")
    .select(
      "id, word, reading, part_of_speech, definition_ja, status, next_review_at, created_at, source_image_path"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const rows = (cards ?? []) as Pick<
    Card,
    | "id"
    | "word"
    | "reading"
    | "part_of_speech"
    | "definition_ja"
    | "status"
    | "next_review_at"
    | "created_at"
    | "source_image_path"
  >[];

  // Bulk-sign screenshot URLs (1 hour TTL)
  const paths = Array.from(
    new Set(rows.map((r) => r.source_image_path).filter((p): p is string => !!p))
  );
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from("screenshots")
      .createSignedUrls(paths, 3600);
    if (data) {
      for (const item of data) {
        if (item.signedUrl && item.path) signed.set(item.path, item.signedUrl);
      }
    }
  }

  const listRows: CardRow[] = rows.map((r) => ({
    ...r,
    image_url: r.source_image_path
      ? signed.get(r.source_image_path) ?? null
      : null,
  }));

  return (
    <PageShell title="カード">
      <div className="py-6">
        <CardsList cards={listRows} />
      </div>
    </PageShell>
  );
}
