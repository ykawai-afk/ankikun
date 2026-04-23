import Link from "next/link";
import { ArrowRight, Sprout } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { PageShell } from "@/components/page-shell";
import { groupCardsByRoot, type RootCard } from "@/lib/root-groups";

export const dynamic = "force-dynamic";

export default async function RootReviewListPage() {
  const supabase = createAdminClient();
  const userId = getUserId();

  const { data: cards } = await supabase
    .from("cards")
    .select("id, word, deep_dive, interval_days, status")
    .eq("user_id", userId)
    .neq("status", "suspended")
    .not("deep_dive", "is", null);

  const groups = groupCardsByRoot((cards ?? []) as RootCard[]);

  return (
    <PageShell title="語根で復習">
      <div className="py-4 flex flex-col gap-3 pb-8">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <Sprout size={48} className="text-muted" />
            <p className="text-sm text-muted text-center max-w-xs">
              同じ語根を共有するカードが 2 枚以上貯まると、
              ここで語根単位の連続復習ができるようになります。
            </p>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-muted px-1">
              {groups.length} 語根 · 同じ root を持つカードを連続で出題
            </p>
            {groups.map((g) => (
              <Link
                key={g.segment}
                href={`/review/root/${encodeURIComponent(g.segment)}`}
                className="group rounded-xl bg-surface border border-border p-3 flex items-center gap-3 active:scale-[0.99] transition hover:border-accent/40"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {g.display.length <= 6 ? g.display : `${g.display.slice(0, 5)}…`}
                  </span>
                </div>
                <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold truncate">
                      {g.display}
                    </span>
                    {g.origin && (
                      <span className="text-[9px] uppercase tracking-widest text-muted shrink-0">
                        {g.origin}
                      </span>
                    )}
                    <span className="text-[10px] text-muted tabular-nums ml-auto shrink-0">
                      {g.cards.length}枚
                    </span>
                  </div>
                  <span className="text-[11px] text-muted truncate">
                    {g.meaning} · {g.cards.slice(0, 3).map((c) => c.word).join(" / ")}
                    {g.cards.length > 3 ? " …" : ""}
                  </span>
                </div>
                <ArrowRight
                  size={13}
                  className="text-muted group-hover:translate-x-0.5 group-hover:text-accent transition shrink-0"
                />
              </Link>
            ))}
          </>
        )}
      </div>
    </PageShell>
  );
}
