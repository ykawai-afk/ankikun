import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  new: "新規",
  learning: "学習中",
  review: "復習",
  suspended: "停止",
};

export default async function CardsPage() {
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, word, reading, part_of_speech, definition_ja, status, next_review_at, created_at")
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
    <main className="flex flex-1 flex-col p-6 gap-4 max-w-2xl mx-auto w-full">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
          ← ホーム
        </Link>
        <h1 className="text-lg font-semibold">カード ({rows.length})</h1>
        <span className="w-16" />
      </header>

      {rows.length === 0 ? (
        <p className="text-zinc-500 text-center mt-12">まだカードがありません</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {rows.map((c) => (
            <li key={c.id} className="p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-lg break-words">{c.word}</div>
                <div className="text-xs text-zinc-500 shrink-0">
                  {STATUS_LABEL[c.status] ?? c.status}
                </div>
              </div>
              {(c.reading || c.part_of_speech) && (
                <div className="text-xs text-zinc-500">
                  {c.part_of_speech}
                  {c.reading && c.part_of_speech && " · "}
                  {c.reading && `/${c.reading.replace(/\//g, "")}/`}
                </div>
              )}
              <div className="text-sm">{c.definition_ja}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
