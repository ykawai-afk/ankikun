import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Calendar, GraduationCap, Repeat } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/user";
import { PageShell } from "@/components/page-shell";
import type { Card, DeepDive, ExtraExample, RelatedWord, Rating } from "@/lib/types";
import { CardDetailActions } from "./card-detail-actions";

export const dynamic = "force-dynamic";

type ReviewLogRow = {
  rating: Rating;
  reviewed_at: string;
};

const RATING_META: Record<
  Rating,
  { label: string; bg: string; text: string; barBg: string }
> = {
  0: {
    label: "Again",
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    barBg: "bg-red-500",
  },
  1: {
    label: "Hard",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    barBg: "bg-amber-500",
  },
  2: {
    label: "Good",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    barBg: "bg-emerald-500",
  },
  3: {
    label: "Easy",
    bg: "bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
    barBg: "bg-sky-500",
  },
};

function relative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = t - Date.now();
  const days = Math.round(diffMs / 86400000);
  if (days === 0) {
    const hours = Math.round(diffMs / 3600000);
    if (Math.abs(hours) < 1) return "たった今";
    return hours > 0 ? `${hours}時間後` : `${Math.abs(hours)}時間前`;
  }
  return days > 0 ? `${days}日後` : `${Math.abs(days)}日前`;
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const userId = getUserId();

  const { data: card } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single<Card>();

  if (!card) notFound();

  const { data: logsData } = await supabase
    .from("review_logs")
    .select("rating, reviewed_at")
    .eq("card_id", id)
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(200);

  const logs = (logsData ?? []) as ReviewLogRow[];
  const counts: Record<Rating, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const l of logs) counts[l.rating] = (counts[l.rating] ?? 0) + 1;
  const totalLogs = logs.length;
  const maxCount = Math.max(1, ...Object.values(counts));
  const lastReviewed = logs[0]?.reviewed_at ?? card.last_reviewed_at;

  let imageUrl: string | null = null;
  if (card.source_image_path) {
    const { data } = await supabase.storage
      .from("screenshots")
      .createSignedUrl(card.source_image_path, 3600);
    imageUrl = data?.signedUrl ?? null;
  }

  return (
    <PageShell title={card.word}>
      <div className="py-4 flex flex-col gap-4 pb-8">
        <header className="flex items-center justify-between">
          <Link
            href="/cards"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition"
          >
            <ArrowLeft size={12} />
            カード一覧
          </Link>
          <CardDetailActions card={card} />
        </header>

        <section className="flex flex-col gap-2">
          {card.tags && card.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {card.tags.map((t) => (
                <span
                  key={t}
                  className="text-[9px] uppercase tracking-widest text-accent bg-accent-soft rounded-full px-2 py-0.5"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-3xl font-semibold tracking-tight break-words">
              {card.word}
            </h1>
            {card.reading && (
              <span className="text-sm text-muted font-mono">
                /{card.reading.replace(/\//g, "")}/
              </span>
            )}
          </div>
          {card.part_of_speech && (
            <span className="text-[10px] uppercase tracking-widest text-muted">
              {card.part_of_speech}
            </span>
          )}
        </section>

        <section className="rounded-2xl bg-surface-2 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-[11px]">
            <InfoCell
              icon={<Calendar size={11} />}
              label="次回"
              value={relative(card.next_review_at)}
            />
            <InfoCell
              icon={<Repeat size={11} />}
              label="間隔"
              value={`${card.interval_days}日`}
            />
            <InfoCell
              icon={<GraduationCap size={11} />}
              label="Ease"
              value={card.ease_factor.toFixed(2)}
            />
          </div>
          {totalLogs > 0 ? (
            <div className="flex flex-col gap-1.5">
              {([0, 1, 2, 3] as Rating[]).map((r) => {
                const meta = RATING_META[r];
                const c = counts[r];
                const pct = (c / maxCount) * 100;
                return (
                  <div key={r} className="flex items-center gap-2 text-[11px]">
                    <span className={`w-12 font-medium ${meta.text}`}>
                      {meta.label}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-border/40 overflow-hidden">
                      <div
                        className={`h-full ${meta.barBg} rounded-full transition-[width]`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums font-medium">
                      {c}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between items-baseline pt-1 text-[10px] text-muted">
                <span>
                  累計 <span className="tabular-nums font-medium text-foreground">{totalLogs}</span> 回
                </span>
                <span>直近: {relative(lastReviewed)}</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-muted">まだ復習していません</div>
          )}
        </section>

        <section className="flex flex-col gap-1.5">
          <Label>意味</Label>
          <div className="rounded-2xl bg-surface-2 px-4 py-3.5 flex flex-col gap-1.5 border-l-2 border-accent">
            <div className="text-lg font-semibold leading-snug tracking-tight">
              {card.definition_ja}
            </div>
            {card.definition_en && (
              <div className="text-[11px] text-muted leading-relaxed">
                {card.definition_en}
              </div>
            )}
          </div>
        </section>

        {card.example_en && (
          <section className="flex flex-col gap-1.5">
            <Label>例文</Label>
            <div className="rounded-xl border border-border p-4 flex flex-col gap-1">
              <p className="text-sm leading-relaxed">{card.example_en}</p>
              {card.example_ja && (
                <p className="text-[11px] text-muted leading-relaxed">
                  {card.example_ja}
                </p>
              )}
            </div>
          </section>
        )}

        {card.etymology && (
          <section className="flex flex-col gap-1.5">
            <Label>語源</Label>
            <div className="rounded-lg px-3 py-2 flex gap-2 bg-surface-2/40">
              <BookOpen
                size={12}
                className="text-muted shrink-0 mt-0.5 opacity-70"
              />
              <p className="text-[12px] leading-relaxed text-muted">
                {card.etymology}
              </p>
            </div>
          </section>
        )}

        {card.related_words && card.related_words.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <Label>Word family</Label>
            <ul className="flex flex-col gap-0.5 rounded-lg px-3 py-2 bg-surface-2/40">
              {(card.related_words as RelatedWord[]).map((w, i) => (
                <li
                  key={`${w.word}-${i}`}
                  className="flex items-baseline gap-2 text-[12px]"
                >
                  <span className="font-medium">{w.word}</span>
                  {w.part_of_speech && (
                    <span className="text-[9px] text-muted">
                      {w.part_of_speech}
                    </span>
                  )}
                  <span className="text-muted">{w.meaning_ja}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {card.extra_examples && card.extra_examples.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <Label>他の例文</Label>
            <div className="flex flex-col gap-1.5">
              {(card.extra_examples as ExtraExample[]).map((e, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/60 px-3 py-2.5 flex flex-col gap-0.5"
                >
                  <p className="text-[12px] leading-relaxed">{e.en}</p>
                  <p className="text-[11px] text-muted leading-relaxed">
                    {e.ja}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {card.deep_dive && <DeepDiveBlock deepDive={card.deep_dive} />}

        {imageUrl && (
          <section className="flex flex-col gap-1.5">
            <Label>取り込み元</Label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="source"
              className="rounded-xl border border-border max-w-full object-contain"
              loading="lazy"
            />
          </section>
        )}
      </div>
    </PageShell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] uppercase tracking-widest text-muted font-semibold px-1">
      {children}
    </span>
  );
}

function InfoCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex-1 flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted font-semibold">
        {icon}
        {label}
      </span>
      <span className="text-[12px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function DeepDiveBlock({ deepDive }: { deepDive: DeepDive }) {
  return (
    <section className="flex flex-col gap-1.5">
      <Label>最終兵器 · 語根で覚える</Label>
      <div className="rounded-xl bg-surface-2/60 border border-accent/20 p-3 flex flex-col gap-2.5">
        {deepDive.roots.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[8px] uppercase tracking-widest text-muted font-semibold">
              語根分解
            </span>
            {deepDive.roots.map((r, i) => (
              <div
                key={`${r.segment}-${i}`}
                className="flex items-baseline gap-2 text-[12px]"
              >
                <span className="font-mono font-semibold text-accent shrink-0">
                  {r.segment}
                </span>
                {r.origin && (
                  <span className="text-[10px] text-muted shrink-0">
                    {r.origin}
                  </span>
                )}
                <span className="text-foreground/80 leading-relaxed">
                  {r.meaning}
                </span>
              </div>
            ))}
          </div>
        )}
        {deepDive.cognates.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[8px] uppercase tracking-widest text-muted font-semibold">
              同根語ネットワーク
            </span>
            <ul className="flex flex-col gap-0.5">
              {deepDive.cognates.map((c, i) => (
                <li
                  key={`${c.word}-${i}`}
                  className="flex items-baseline gap-2 text-[12px]"
                >
                  <span className="font-semibold min-w-[72px]">{c.word}</span>
                  <span className="text-muted leading-relaxed">
                    {c.meaning_ja}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {deepDive.hook && (
          <p className="text-[12px] leading-relaxed text-foreground/90 border-t border-accent/15 pt-2">
            💡 {deepDive.hook}
          </p>
        )}
      </div>
    </section>
  );
}
