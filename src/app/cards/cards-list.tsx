"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import type { Card } from "@/lib/types";

type Row = Pick<
  Card,
  | "id"
  | "word"
  | "reading"
  | "part_of_speech"
  | "definition_ja"
  | "status"
  | "next_review_at"
  | "created_at"
>;

const FILTERS: { key: "all" | Card["status"]; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "new", label: "新規" },
  { key: "learning", label: "学習中" },
  { key: "review", label: "復習" },
];

const STATUS_COLOR: Record<string, string> = {
  new: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  learning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  review: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  suspended: "bg-zinc-500/10 text-zinc-500",
};

const STATUS_LABEL: Record<string, string> = {
  new: "新規",
  learning: "学習中",
  review: "復習",
  suspended: "停止",
};

export function CardsList({ cards }: { cards: Row[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Card["status"]>("all");

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
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="単語・意味で検索"
          className="w-full h-11 pl-10 pr-4 rounded-2xl bg-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`h-8 px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                active
                  ? "bg-accent text-accent-foreground"
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
        <div className="text-center text-muted py-16 text-sm">
          {cards.length === 0 ? "まだカードがありません" : "該当なし"}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((c, i) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(i * 0.015, 0.25),
                ease: [0.16, 1, 0.3, 1],
              }}
              className="rounded-2xl bg-surface-2 p-4 flex flex-col gap-1.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-lg tracking-tight break-words">
                      {c.word}
                    </span>
                    {c.reading && (
                      <span className="text-xs text-muted font-mono">
                        /{c.reading.replace(/\//g, "")}/
                      </span>
                    )}
                  </div>
                  {c.part_of_speech && (
                    <span className="text-[10px] uppercase tracking-widest text-muted">
                      {c.part_of_speech}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 font-medium ${
                    STATUS_COLOR[c.status] ?? ""
                  }`}
                >
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <div className="text-sm text-foreground/80 leading-relaxed">
                {c.definition_ja}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
