"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, X } from "lucide-react";
import type { Card } from "@/lib/types";
import { haptic } from "@/lib/haptics";
import { isTypingMatch } from "@/lib/typing";
import { grade } from "../actions";

type Phase = "input" | "correct" | "wrong";

type Prompt = {
  /** Tag rendered above the prompt block. */
  label: string;
  /** Card type-specific main prompt content. */
  main: React.ReactNode;
  /** Optional secondary hint shown under the main prompt. */
  hint?: React.ReactNode;
  /** Input placeholder. */
  placeholder: string;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render the phrase blanked out in its example sentence. Pattern-style
 * phrases (e.g. "apply X to Y") whose literal form doesn't appear in the
 * example fall back to `null` so callers can pick a different prompt mode.
 */
function clozeExample(example: string, phrase: string): string | null {
  // Strip trailing punctuation/whitespace from the phrase so "Got it." still
  // blanks correctly when the example reads "Got it. I'll handle that next."
  const stripped = phrase.replace(/[.,!?;:'"]+$/, "").trim();
  if (!stripped) return null;
  const re = new RegExp(escapeRegExp(stripped), "i");
  if (!re.test(example)) return null;
  return example.replace(re, "_______");
}

function buildPrompt(card: Card): Prompt {
  if (card.card_type === "expression") {
    const clozed =
      card.example_en && clozeExample(card.example_en, card.word);
    if (clozed) {
      return {
        label: "空欄を埋める",
        main: (
          <p className="text-lg sm:text-xl font-semibold leading-snug tracking-tight">
            {clozed}
          </p>
        ),
        hint: card.example_ja ? (
          <p className="text-xs text-muted leading-snug">{card.example_ja}</p>
        ) : null,
        placeholder: "type the phrase…",
      };
    }
    return {
      label: "フレーズを入力",
      main: (
        <p className="text-lg sm:text-xl font-semibold leading-snug tracking-tight">
          {card.definition_ja}
        </p>
      ),
      hint: card.example_ja ? (
        <p className="text-xs text-muted leading-snug">{card.example_ja}</p>
      ) : null,
      placeholder: "type the phrase…",
    };
  }
  return {
    label: "英訳を入力",
    main: (
      <p className="text-xl sm:text-2xl font-semibold leading-snug tracking-tight">
        {card.definition_ja}
      </p>
    ),
    hint: card.part_of_speech ? (
      <span className="text-[10px] uppercase tracking-widest text-muted">
        {card.part_of_speech}
      </span>
    ) : null,
    placeholder: "type the word…",
  };
}

export function TypingSession({ initialQueue }: { initialQueue: Card[] }) {
  const router = useRouter();
  const [queue] = useState<Card[]>(initialQueue);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [counts, setCounts] = useState({ correct: 0, wrong: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const card = queue[idx] as Card | undefined;
  const total = queue.length;

  useEffect(() => {
    if (phase === "input") {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [phase, idx]);

  const check = useCallback(() => {
    if (!card || phase !== "input") return;
    if (!value.trim()) return;
    const ok = isTypingMatch(value, card.word);

    haptic(ok ? "good" : "again");
    setCounts((c) =>
      ok ? { ...c, correct: c.correct + 1 } : { ...c, wrong: c.wrong + 1 }
    );
    setPhase(ok ? "correct" : "wrong");

    const cardId = card.id;
    const rating = ok ? 2 : 0;
    setTimeout(() => {
      grade(cardId, rating).catch((e) => console.error("grade failed", e));
    }, 0);
  }, [card, phase, value]);

  const next = useCallback(() => {
    setValue("");
    setPhase("input");
    if (idx >= queue.length - 1) {
      router.refresh();
      setIdx(queue.length);
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, queue.length, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== "input" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, next]);

  const progress = total > 0 ? Math.min(100, (idx / total) * 100) : 0;

  const flashColor = useMemo(() => {
    if (phase === "correct") return "rgba(16,185,129,0.14)";
    if (phase === "wrong") return "rgba(239,68,68,0.14)";
    return "transparent";
  }, [phase]);

  const prompt = useMemo(
    () => (card ? buildPrompt(card) : null),
    [card]
  );

  if (!card || !prompt) {
    return <TypingSummary counts={counts} total={total} />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-svh relative">
      <div
        aria-hidden
        style={{ backgroundColor: flashColor }}
        className="pointer-events-none fixed inset-0 z-10 transition-[background-color] duration-300 ease-out"
      />

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
          <span className="text-[10px] text-muted tabular-nums w-10 text-right">
            {idx + 1}/{total}
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pb-32 flex flex-col">
        <motion.article
          key={card.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="flex-1 flex flex-col items-center justify-center gap-4 py-5"
        >
          <span className="text-[9px] uppercase tracking-widest text-accent font-semibold">
            {prompt.label}
          </span>

          <div className="rounded-2xl bg-surface-2 px-4 py-4 border-l-2 border-accent w-full max-w-md flex flex-col gap-1.5">
            {prompt.main}
            {prompt.hint}
          </div>

          <AnimatePresence mode="wait">
            {phase === "input" ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-md"
              >
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      check();
                    }
                  }}
                  placeholder={prompt.placeholder}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-14 px-4 rounded-xl bg-background border-2 border-border focus:border-accent focus:outline-none text-lg text-center font-mono tracking-wide"
                />
              </motion.div>
            ) : phase === "correct" ? (
              <motion.div
                key="correct"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md flex flex-col items-center gap-1.5"
              >
                <div className="flex items-center gap-1.5 text-success font-semibold">
                  <Check size={16} />
                  <span className="text-base">正解</span>
                </div>
                <div className="text-2xl font-semibold tracking-tight">
                  {card.word}
                </div>
                {card.reading && (
                  <div className="text-xs text-muted font-mono">
                    /{card.reading.replace(/\//g, "")}/
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="wrong"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md flex flex-col items-center gap-1.5"
              >
                <div className="flex items-center gap-1.5 text-danger font-semibold">
                  <X size={16} />
                  <span className="text-base">不正解</span>
                </div>
                <div className="text-[11px] text-muted line-through">
                  {value}
                </div>
                <div className="text-2xl font-semibold tracking-tight">
                  {card.word}
                </div>
                {card.reading && (
                  <div className="text-xs text-muted font-mono">
                    /{card.reading.replace(/\//g, "")}/
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.article>
      </main>

      <div className="fixed bottom-16 left-0 right-0 z-20 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-3">
        <div className="max-w-xl mx-auto px-4">
          {phase === "input" ? (
            <button
              type="button"
              onClick={check}
              disabled={!value.trim()}
              className="w-full h-11 rounded-xl bg-accent text-accent-foreground font-medium text-sm active:scale-[0.98] transition shadow-[0_8px_24px_-10px_var(--accent)] disabled:opacity-50"
            >
              チェック
              <span className="ml-2 text-[10px] opacity-60">Enter</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="w-full h-11 rounded-xl bg-foreground text-background font-medium text-sm active:scale-[0.98] transition"
            >
              次のカード
              <span className="ml-2 text-[10px] opacity-60">Enter</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingSummary({
  counts,
  total,
}: {
  counts: { correct: number; wrong: number };
  total: number;
}) {
  const done = counts.correct + counts.wrong;
  const rate = done > 0 ? Math.round((counts.correct / done) * 100) : 0;

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 min-h-svh flex-col items-center gap-5 p-6 pb-24"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-8">
        <div className="text-5xl">{rate >= 80 ? "🏆" : rate >= 50 ? "🎯" : "📚"}</div>
        <div className="text-center">
          <p className="text-xl font-semibold">英訳ドリル完了</p>
          <p className="text-xs text-muted mt-0.5">
            {done}/{total} 完了
          </p>
        </div>
        <div className="w-full grid grid-cols-2 gap-1.5">
          <Chip
            label="正解"
            value={counts.correct}
            color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <Chip
            label="不正解"
            value={counts.wrong}
            color="bg-red-500/10 text-red-600 dark:text-red-400"
          />
        </div>
        <div className="w-full rounded-xl bg-surface-2 p-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            正答率
          </span>
          <span className="text-base font-semibold tabular-nums">{rate}%</span>
        </div>
      </div>
      <Link
        href="/"
        className="h-10 px-5 rounded-xl bg-accent text-accent-foreground flex items-center text-xs font-medium active:scale-95 transition"
      >
        ホームへ戻る
      </Link>
    </motion.main>
  );
}

function Chip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-2 flex flex-col items-center gap-0 ${color}`}>
      <span className="text-[9px] uppercase tracking-widest font-semibold opacity-80">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
