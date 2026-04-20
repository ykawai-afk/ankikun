import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { PageShell } from "@/components/page-shell";
import { CardsList } from "./cards-list";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const supabase = createAdminClient();
  const userId = getUserId();

  const { data: cards } = await supabase
    .from("cards")
    .select(
      "id, word, reading, part_of_speech, definition_ja, status, next_review_at, created_at"
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
  >[];

  return (
    <PageShell title="カード">
      <div className="py-6">
        <CardsList cards={rows} />
      </div>
    </PageShell>
  );
}
