"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import type { Card } from "@/lib/types";
import { CardModal } from "./card-modal";

export type CardRow = Pick<
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
> & { image_url: string | null };

const FILTERS: { key: "all" | Card["status"]; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "new", label: "新規" },
  { key: "learning", label: "学習中" },
  { key: "review", label: "復習" },
];

const STATUS_STYLE: Record<string, string> = {
  new: "bg-accent-soft text-accent",
  learning: "bg-flame-soft text-flame",
  review: "bg-success-soft text-success",
  suspended: "bg-surface-2 text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  new: "新規",
  learning: "学習中",
  review: "復習",
  suspended: "停止",
};

export function CardsList({ cards }: { cards: CardRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Card["status"]>("all");
  const [selected, setSelected] = useState<CardRow | null>(null);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.word.toLowerCase().includes(q) ||
        c.definition_ja.toLowerCase().includes(q)
      );
    });
  }, [cards, filter, query]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="単語・意味で検索"
          className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`h-7 px-3 rounded-full text-[11px] font-medium whitespace-nowrap transition active:scale-95 ${
                active
                  ? "bg-accent text-accent-foreground shadow-[0_3px_10px_-4px_var(--accent)]"
                  : "bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center text-muted py-10 text-xs">
          {cards.length === 0 ? "まだカードがありません" : "該当なし"}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {filtered.map((c, i) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.18,
                delay: Math.min(i * 0.012, 0.2),
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => setSelected(c)}
              className="rounded-xl bg-surface p-3 border border-border/60 flex flex-col gap-1 cursor-pointer hover:border-accent/40 active:scale-[0.995] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm tracking-tight break-words">
                      {c.word}
                    </span>
                    {c.reading && (
                      <span className="text-[10px] text-muted font-mono">
                        /{c.reading.replace(/\//g, "")}/
                      </span>
                    )}
                  </div>
                  {c.part_of_speech && (
                    <span className="text-[9px] uppercase tracking-widest text-muted">
                      {c.part_of_speech}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
                    STATUS_STYLE[c.status] ?? ""
                  }`}
                >
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <div className="text-xs text-foreground/80 leading-relaxed">
                {c.definition_ja}
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      {selected && (
        <CardModal card={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
