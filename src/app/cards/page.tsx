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
      "id, word, reading, part_of_speech, definition_ja, status, next_review_at, created_at, source_image_path, etymology"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const rows: CardRow[] = ((cards ?? []) as Pick<
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
    | "etymology"
  >[]).map((r) => ({ ...r, image_url: null }));

  return (
    <PageShell title="カード">
      <div className="py-6">
        <CardsList cards={rows} />
      </div>
    </PageShell>
  );
}
