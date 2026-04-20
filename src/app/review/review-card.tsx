"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Volume2 } from "lucide-react";
import type { Card, Rating } from "@/lib/types";
import { grade } from "./actions";

const BUTTONS: {
  rating: Rating;
  label: string;
  hint: string;
  key: string;
  className: string;
}[] = [
  {
    rating: 0,
    label: "Again",
    hint: "< 1分",
    key: "1",
    className:
      "bg-red-500 hover:bg-red-500/90 text-white dark:bg-red-500/90 dark:hover:bg-red-500",
  },
  {
    rating: 1,
    label: "Hard",
    hint: "短め",
    key: "2",
    className:
      "bg-amber-500 hover:bg-amber-500/90 text-white dark:bg-amber-500/90",
  },
  {
    rating: 2,
    label: "Good",
    hint: "標準",
    key: "3",
    className:
      "bg-emerald-600 hover:bg-emerald-600/90 text-white dark:bg-emerald-500/90",
  },
  {
    rating: 3,
    label: "Easy",
    hint: "長め",
    key: "4",
    className:
      "bg-sky-600 hover:bg-sky-600/90 text-white dark:bg-sky-500/90",
  },
];

export function ReviewCard({
  card,
  remaining,
  totalDue,
}: {
  card: Card;
  remaining: number;
  totalDue: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const [pending, startTransition] = useTransition();

  const rate = useCallback(
    (r: Rating) => {
      if (!revealed || pending) return;
      startTransition(() => grade(card.id, r));
    },
    [card.id, pending, revealed]
  );

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(card.word);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [card.word]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const idx = ["1", "2", "3", "4"].indexOf(e.key);
        if (idx >= 0) {
          e.preventDefault();
          rate(idx as Rating);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [rate, revealed]);

  const progress =
    totalDue > 0
      ? Math.max(0, Math.min(100, ((totalDue - remaining + 1) / totalDue) * 100))
      : 0;

  return (
    <div className="flex flex-col flex-1 min-h-svh">
      {/* Top bar: back + progress */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-3 h-14 px-5">
          <Link
            href="/"
            aria-label="ホームへ"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-2 active:scale-95 transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
              className="h-full bg-accent"
            />
          </div>
          <span className="text-xs text-muted tabular-nums w-10 text-right">
            {remaining}
          </span>
        </div>
      </div>

      {/* Card area */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-5 pb-40 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.article
            key={card.id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center gap-6 py-10"
          >
            {/* Word + pronunciation */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-5xl sm:text-6xl font-semibold tracking-tight text-center break-words">
                  {card.word}
                </h2>
                <button
                  onClick={speak}
                  aria-label="発音を聞く"
                  className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center active:scale-95 hover:bg-border/50 transition"
                >
                  <Volume2 size={18} />
                </button>
              </div>
              {card.reading && (
                <div className="text-sm text-muted font-mono">
                  /{card.reading.replace(/\//g, "")}/
                </div>
              )}
              {card.part_of_speech && (
                <span className="text-[10px] uppercase tracking-widest text-muted border border-border rounded-full px-2.5 py-0.5">
                  {card.part_of_speech}
                </span>
              )}
            </div>

            {/* Meaning (revealed) */}
            <AnimatePresence initial={false}>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-md flex flex-col gap-4 mt-4"
                >
                  <div className="rounded-2xl bg-surface-2 p-5 flex flex-col gap-2">
                    <div className="text-lg leading-relaxed">
                      {card.definition_ja}
                    </div>
                    {card.definition_en && (
                      <div className="text-sm text-muted">
                        {card.definition_en}
                      </div>
                    )}
                  </div>
                  {card.example_en && (
                    <blockquote className="rounded-2xl border border-border p-5 flex flex-col gap-1">
                      <p className="text-sm leading-relaxed">
                        {card.example_en}
                      </p>
                      {card.example_ja && (
                        <p className="text-sm text-muted leading-relaxed">
                          {card.example_ja}
                        </p>
                      )}
                    </blockquote>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
        </AnimatePresence>
      </main>

      {/* Bottom action area */}
      <div className="fixed bottom-16 left-0 right-0 z-20 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4">
        <div className="max-w-2xl mx-auto px-5">
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="w-full h-14 rounded-2xl bg-accent text-accent-foreground font-medium text-lg active:scale-[0.98] transition"
            >
              答えを表示
              <span className="ml-2 text-xs opacity-60">Space</span>
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {BUTTONS.map((b) => (
                <button
                  key={b.rating}
                  onClick={() => rate(b.rating)}
                  disabled={pending}
                  className={`h-16 rounded-2xl font-semibold text-sm flex flex-col items-center justify-center gap-0.5 active:scale-[0.97] transition disabled:opacity-50 ${b.className}`}
                >
                  <span>{b.label}</span>
                  <span className="text-[10px] opacity-80 font-normal">
                    {b.hint}
                  </span>
                </button>
              ))}
            </div>
          )}
          {revealed && (
            <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-muted">
              <Kbd>1</Kbd>
              <Kbd>2</Kbd>
              <Kbd>3</Kbd>
              <Kbd>4</Kbd>
              <span className="ml-1">で評価</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded border border-border bg-surface-2 text-[10px] font-mono">
      {children}
    </kbd>
  );
}
