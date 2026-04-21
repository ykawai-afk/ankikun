"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { ArrowLeft, BookOpen, GraduationCap, Volume2 } from "lucide-react";
import confetti from "canvas-confetti";
import type {
  Card,
  ExtraExample,
  Rating,
  RelatedWord,
} from "@/lib/types";
import { haptic } from "@/lib/haptics";
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

function clozeSentence(sentence: string, word: string): string {
  const base = word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp(`\\b${base}\\w*\\b`, "gi");
  return sentence.replace(re, "_____");
}

type Counts = { again: number; hard: number; good: number; easy: number };

function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

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
  const [cloze, setCloze] = useState(false);
  const [counts, setCounts] = useState<Counts>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const startRef = useRef<number>(Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("ankikun.cloze")
        : null;
    if (stored === "1") setCloze(true);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ankikun.cloze", cloze ? "1" : "0");
    }
  }, [cloze]);

  const card = queue[idx] as Card | undefined;

  const rate = useCallback(
    (r: Rating) => {
      if (!revealed || !card) return;
      const cardId = card.id;
      const isLast = idx >= queue.length - 1;

      haptic(r === 0 ? "again" : r === 1 ? "medium" : r === 2 ? "good" : "light");
      setFlash(r);
      setTimeout(() => setFlash(null), 280);

      setCounts((c) => ({
        again: c.again + (r === 0 ? 1 : 0),
        hard: c.hard + (r === 1 ? 1 : 0),
        good: c.good + (r === 2 ? 1 : 0),
        easy: c.easy + (r === 3 ? 1 : 0),
      }));

      setRevealed(false);
      if (isLast) {
        setIdx(queue.length);
        setFinishedAt(Date.now());
        haptic("heavy");
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

  const clozeFront = useMemo(() => {
    if (!card || !cloze || !card.example_en) return null;
    return clozeSentence(card.example_en, card.word);
  }, [card, cloze]);

  const onPanEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (!revealed) return;
      const { x, y } = info.offset;
      const threshold = 70;
      if (Math.abs(x) > Math.abs(y)) {
        if (x > threshold) rate(2); // right → Good
        else if (x < -threshold) rate(0); // left → Again
      } else {
        if (y < -threshold) rate(3); // up → Easy
        else if (y > threshold) rate(1); // down → Hard
      }
    },
    [rate, revealed]
  );

  if (!card) {
    return (
      <SessionSummary
        counts={counts}
        durationMs={(finishedAt ?? Date.now()) - startRef.current}
        total={totalDue}
      />
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
          <button
            type="button"
            onClick={() => setCloze((v) => !v)}
            aria-pressed={cloze}
            className={`h-6 px-2 rounded-full text-[10px] font-semibold transition active:scale-95 ${
              cloze
                ? "bg-accent text-accent-foreground"
                : "bg-surface-2 text-muted"
            }`}
          >
            Cloze
          </button>
          <span className="text-[10px] text-muted tabular-nums w-7 text-right">
            {remaining}
          </span>
        </div>
      </div>

      {/* Card area */}
      <main className="flex-1 max-w-xl mx-auto w-full px-4 pb-32 flex flex-col">
        <motion.article
          key={card.id}
          drag={revealed ? true : false}
          dragElastic={0.18}
          dragSnapToOrigin
          dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
          onPanEnd={onPanEnd}
          className="flex-1 flex flex-col items-center justify-center gap-3 py-5 touch-pan-y"
          style={{ touchAction: revealed ? "none" : "pan-y" }}
        >
          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-center">
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

          {/* Image */}
          {card.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image_url}
              alt=""
              className="w-full max-w-xs aspect-[4/3] object-cover rounded-2xl pointer-events-none"
              loading="lazy"
              draggable={false}
            />
          )}

          {cloze && clozeFront ? (
            <div className="flex flex-col items-center gap-2 w-full max-w-md">
              <span className="text-[10px] uppercase tracking-widest text-muted">
                Cloze · この空欄は？
              </span>
              <p className="text-xl leading-relaxed text-center">
                {clozeFront}
              </p>
              {card.example_ja && (
                <p className="text-xs text-muted text-center">{card.example_ja}</p>
              )}
            </div>
          ) : (
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
          )}

          <AnimatePresence initial={false}>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="w-full max-w-md flex flex-col gap-2 mt-1"
              >
                {cloze && (
                  <div className="rounded-xl bg-accent-soft p-3 text-center">
                    <span className="text-[10px] uppercase tracking-widest text-accent font-semibold">
                      答え
                    </span>
                    <div className="text-2xl font-semibold tracking-tight mt-0.5 flex items-center justify-center gap-2">
                      {card.word}
                      <button
                        onClick={speak}
                        aria-label="発音を聞く"
                        className="w-7 h-7 rounded-full bg-background flex items-center justify-center active:scale-95 hover:opacity-90 transition"
                      >
                        <Volume2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
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
                {card.example_en && !cloze && (
                  <blockquote className="rounded-xl border border-border p-3 flex flex-col gap-0.5">
                    <p className="text-xs leading-relaxed">{card.example_en}</p>
                    {card.example_ja && (
                      <p className="text-xs text-muted leading-relaxed">
                        {card.example_ja}
                      </p>
                    )}
                  </blockquote>
                )}
                {card.etymology && (
                  <div className="rounded-xl bg-accent-soft p-3 flex gap-2">
                    <BookOpen
                      size={13}
                      className="text-accent shrink-0 mt-0.5"
                    />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[9px] uppercase tracking-widest text-accent/80 font-semibold">
                        語源
                      </span>
                      <p className="text-xs leading-relaxed">
                        {card.etymology}
                      </p>
                    </div>
                  </div>
                )}
                {card.related_words && card.related_words.length > 0 && (
                  <RelatedWordsPanel items={card.related_words} />
                )}
                {card.extra_examples && card.extra_examples.length > 0 && (
                  <ExtraExamplesPanel items={card.extra_examples} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.article>
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
            <>
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
              <div className="flex items-center justify-center gap-1 mt-2 text-[9px] text-muted">
                <Kbd>1</Kbd>
                <Kbd>2</Kbd>
                <Kbd>3</Kbd>
                <Kbd>4</Kbd>
                <span className="mx-1">·</span>
                <span>スワイプでも評価</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionSummary({
  counts,
  durationMs,
  total,
}: {
  counts: Counts;
  durationMs: number;
  total: number;
}) {
  const reviewed = counts.again + counts.hard + counts.good + counts.easy;
  const keptRate = reviewed
    ? Math.round(((counts.good + counts.easy + counts.hard) / reviewed) * 100)
    : 0;

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 min-h-svh flex-col items-center gap-5 p-6 pb-24"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-8">
        <div className="text-5xl">🎉</div>
        <div className="text-center">
          <p className="text-xl font-semibold">お疲れさま</p>
          <p className="text-xs text-muted mt-0.5">
            {reviewed}/{total} 完了 · {formatDuration(durationMs)}
          </p>
        </div>

        <div className="w-full grid grid-cols-4 gap-1.5">
          <Chip label="Again" value={counts.again} color="bg-red-500/10 text-red-600 dark:text-red-400" />
          <Chip label="Hard" value={counts.hard} color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
          <Chip label="Good" value={counts.good} color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <Chip label="Easy" value={counts.easy} color="bg-sky-500/10 text-sky-600 dark:text-sky-400" />
        </div>

        {reviewed > 0 && (
          <div className="w-full rounded-xl bg-surface-2 p-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted">
              定着率
            </span>
            <span className="text-base font-semibold tabular-nums">
              {keptRate}%
            </span>
          </div>
        )}
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

function RelatedWordsPanel({ items }: { items: RelatedWord[] }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 flex flex-col gap-1.5">
      <span className="text-[9px] uppercase tracking-widest text-muted font-semibold flex items-center gap-1">
        <GraduationCap size={11} /> Word family
      </span>
      <ul className="flex flex-col gap-1">
        {items.map((w, i) => (
          <li
            key={`${w.word}-${i}`}
            className="flex items-baseline gap-2 text-xs"
          >
            <span className="font-semibold">{w.word}</span>
            {w.part_of_speech && (
              <span className="text-[10px] text-muted">{w.part_of_speech}</span>
            )}
            <span className="text-muted">{w.meaning_ja}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExtraExamplesPanel({ items }: { items: ExtraExample[] }) {
  const registerLabel = (r: ExtraExample["register"]) =>
    r === "formal" ? "formal" : r === "conversational" ? "casual" : r === "idiom" ? "idiom" : null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] uppercase tracking-widest text-muted font-semibold px-1">
        他の例文
      </span>
      <div className="flex flex-col gap-1.5">
        {items.map((e, i) => {
          const reg = registerLabel(e.register);
          return (
            <blockquote
              key={i}
              className="rounded-xl border border-border p-2.5 flex flex-col gap-0.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs leading-relaxed">{e.en}</p>
                {reg && (
                  <span className="text-[9px] uppercase tracking-widest text-muted shrink-0">
                    {reg}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted leading-relaxed">{e.ja}</p>
            </blockquote>
          );
        })}
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
