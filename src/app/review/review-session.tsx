"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Volume2 } from "lucide-react";
import confetti from "canvas-confetti";
import type { Card, Rating } from "@/lib/types";
import { grade } from "./actions";

const BUTTONS: {
  rating: Rating;
  label: string;
  hint: string;
  className: string;
}[] = [
  {
    rating: 0,
    label: "Again",
    hint: "< 1分",
    className:
      "bg-red-500 hover:bg-red-500/90 text-white dark:bg-red-500/90 dark:hover:bg-red-500",
  },
  {
    rating: 1,
    label: "Hard",
    hint: "短め",
    className:
      "bg-amber-500 hover:bg-amber-500/90 text-white dark:bg-amber-500/90",
  },
  {
    rating: 2,
    label: "Good",
    hint: "標準",
    className:
      "bg-emerald-600 hover:bg-emerald-600/90 text-white dark:bg-emerald-500/90",
  },
  {
    rating: 3,
    label: "Easy",
    hint: "長め",
    className:
      "bg-sky-600 hover:bg-sky-600/90 text-white dark:bg-sky-500/90",
  },
];

export function ReviewSession({
  initialQueue,
  totalDue,
}: {
  initialQueue: Card[];
  totalDue: number;
}) {
  const router = useRouter();
  const [queue] = useState<Card[]>(initialQueue);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState<null | Rating>(null);
  const card = queue[idx] as Card | undefined;

  const rate = useCallback(
    (r: Rating) => {
      if (!revealed || !card) return;
      const cardId = card.id;
      const isLast = idx >= queue.length - 1;

      setFlash(r);
      setTimeout(() => setFlash(null), 280);

      setRevealed(false);
      if (isLast) {
        setIdx(queue.length);
        confetti({
          particleCount: 120,
          spread: 80,
          startVelocity: 45,
          origin: { x: 0.5, y: 0.7 },
          colors: ["#4f46e5", "#818cf8", "#f97316", "#fbbf24", "#10b981"],
        });
      } else {
        setIdx((i) => i + 1);
      }

      setTimeout(() => {
        const p = grade(cardId, r).catch((e) => {
          console.error("grade failed", e);
        });
        if (isLast) p.finally(() => router.refresh());
      }, 0);
    },
    [card, idx, queue.length, revealed, router]
  );

  const speak = useCallback(() => {
    if (!card) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(card.word);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [card]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const pos = ["1", "2", "3", "4"].indexOf(e.key);
        if (pos >= 0) {
          e.preventDefault();
          rate(pos as Rating);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [rate, revealed]);

  if (!card) {
    return (
      <main className="flex flex-1 min-h-svh flex-col items-center justify-center gap-4 p-6 pb-20">
        <div className="text-5xl">🎉</div>
        <p className="text-base">お疲れさま</p>
        <Link
          href="/"
          className="h-9 px-4 rounded-xl bg-accent text-accent-foreground flex items-center text-xs font-medium active:scale-95 transition"
        >
          ホームへ戻る
        </Link>
      </main>
    );
  }

  const done = idx;
  const progress = totalDue > 0 ? Math.min(100, (done / totalDue) * 100) : 0;
  const remaining = Math.max(totalDue - done, 1);

  const flashColor =
    flash === 0
      ? "rgba(239,68,68,0.16)"
      : flash === 1
        ? "rgba(245,158,11,0.14)"
        : flash === 2
          ? "rgba(16,185,129,0.16)"
          : flash === 3
            ? "rgba(14,165,233,0.16)"
            : "transparent";

  return (
    <div className="flex flex-col flex-1 min-h-svh relative">
      <div
        aria-hidden
        style={{ backgroundColor: flashColor }}
        className="pointer-events-none fixed inset-0 z-10 transition-[background-color] duration-200 ease-out"
      />

      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-xl mx-auto flex items-center gap-2.5 h-11 px-4">
          <Link
            href="/"
            aria-label="ホームへ"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-2 active:scale-95 transition"
          >
            <ArrowLeft size={15} />
          </Link>
          <div className="flex-1 h-[3px] rounded-full bg-border overflow-hidden">
            <div
              style={{ width: `${progress}%` }}
              className="h-full bg-accent transition-[width] duration-200 ease-out"
            />
          </div>
          <span className="text-[10px] text-muted tabular-nums w-8 text-right">
            {remaining}
          </span>
        </div>
      </div>

      {/* Card area */}
      <main className="flex-1 max-w-xl mx-auto w-full px-4 pb-32 flex flex-col">
        <article
          key={card.id}
          className="flex-1 flex flex-col items-center justify-center gap-4 py-6"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center break-words">
                {card.word}
              </h2>
              <button
                onClick={speak}
                aria-label="発音を聞く"
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center active:scale-95 hover:bg-border/50 transition"
              >
                <Volume2 size={14} />
              </button>
            </div>
            {card.reading && (
              <div className="text-xs text-muted font-mono">
                /{card.reading.replace(/\//g, "")}/
              </div>
            )}
            {card.part_of_speech && (
              <span className="text-[9px] uppercase tracking-widest text-muted border border-border rounded-full px-2 py-0.5">
                {card.part_of_speech}
              </span>
            )}
          </div>

          <AnimatePresence initial={false}>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="w-full max-w-md flex flex-col gap-2.5 mt-2"
              >
                <div className="rounded-xl bg-surface-2 p-3 flex flex-col gap-1.5">
                  <div className="text-sm leading-relaxed">
                    {card.definition_ja}
                  </div>
                  {card.definition_en && (
                    <div className="text-xs text-muted">
                      {card.definition_en}
                    </div>
                  )}
                </div>
                {card.example_en && (
                  <blockquote className="rounded-xl border border-border p-3 flex flex-col gap-0.5">
                    <p className="text-xs leading-relaxed">{card.example_en}</p>
                    {card.example_ja && (
                      <p className="text-xs text-muted leading-relaxed">
                        {card.example_ja}
                      </p>
                    )}
                  </blockquote>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </article>
      </main>

      {/* Bottom action */}
      <div className="fixed bottom-12 left-0 right-0 z-20 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-3">
        <div className="max-w-xl mx-auto px-4">
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="w-full h-11 rounded-xl bg-accent text-accent-foreground font-medium text-sm active:scale-[0.98] transition shadow-[0_8px_24px_-10px_var(--accent)]"
            >
              答えを表示
              <span className="ml-2 text-[10px] opacity-60">Space</span>
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {BUTTONS.map((b) => (
                <button
                  key={b.rating}
                  onPointerDown={() => rate(b.rating)}
                  style={{ touchAction: "manipulation" }}
                  className={`h-12 rounded-xl font-semibold text-xs flex flex-col items-center justify-center gap-0 active:brightness-90 ${b.className}`}
                >
                  <span>{b.label}</span>
                  <span className="text-[9px] opacity-80 font-normal">
                    {b.hint}
                  </span>
                </button>
              ))}
            </div>
          )}
          {revealed && (
            <div className="flex items-center justify-center gap-1.5 mt-2 text-[9px] text-muted">
              <Kbd>1</Kbd>
              <Kbd>2</Kbd>
              <Kbd>3</Kbd>
              <Kbd>4</Kbd>
              <span className="ml-0.5">で評価</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-border bg-surface-2 text-[9px] font-mono">
      {children}
    </kbd>
  );
}
