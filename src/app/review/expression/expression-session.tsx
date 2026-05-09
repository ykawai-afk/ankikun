"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Copy, Mic, Volume2 } from "lucide-react";
import confetti from "canvas-confetti";
import type { Card, Rating } from "@/lib/types";
import { haptic } from "@/lib/haptics";
import { DAILY_EXPRESSION_TARGET } from "@/lib/goals";
import { grade } from "../actions";

const BUTTONS: {
  rating: Rating;
  label: string;
  hint: string;
  className: string;
}[] = [
  {
    rating: 0,
    label: "Again",
    hint: "言えなかった",
    className:
      "bg-red-500 hover:bg-red-500/90 text-white dark:bg-red-500/90 dark:hover:bg-red-500",
  },
  {
    rating: 1,
    label: "Hard",
    hint: "ぎこちない",
    className:
      "bg-amber-500 hover:bg-amber-500/90 text-white dark:bg-amber-500/90",
  },
  {
    rating: 2,
    label: "Good",
    hint: "自然に使えた",
    className:
      "bg-emerald-600 hover:bg-emerald-600/90 text-white dark:bg-emerald-500/90",
  },
  {
    rating: 3,
    label: "Easy",
    hint: "完璧",
    className:
      "bg-sky-600 hover:bg-sky-600/90 text-white dark:bg-sky-500/90",
  },
];

function buildRoleplayPrompt(expression: string, note: string): string {
  return `以下の表現を自然に使えるようになる会話練習をしてください。

対象表現: ${expression}
補足: ${note}

進め方:
- あなたが会話相手役を演じてください。この表現を使う必然性のある場面・問いかけを自然に振る
- 表現の直接ヒントは出さない（私が思い出して使えるかが目的）
- 1〜3往復で1セッション
- 私が使えたら何が良かったか、使えなかったら模範解答と差分を簡潔にフィードバック
- 最後に「Again / Good / Easy」のどれを推奨するか1つだけ示す`;
}

type Counts = { again: number; hard: number; good: number; easy: number };

function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function ExpressionSession({
  initialQueue,
  totalDue,
  gradedTodayBefore,
}: {
  initialQueue: Card[];
  totalDue: number;
  gradedTodayBefore: number;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<Card[]>(initialQueue);
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState<null | Rating>(null);
  const [copied, setCopied] = useState(false);
  const [counts, setCounts] = useState<Counts>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const startRef = useRef<number>(Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const card = queue[0] as Card | undefined;

  const speak = useCallback((text: string) => {
    if (!text) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  // Reset reveal/copy state on card change.
  useEffect(() => {
    setRevealed(false);
    setCopied(false);
  }, [card?.id]);

  const copyRoleplayPrompt = useCallback(async () => {
    if (!card) return;
    const prompt = buildRoleplayPrompt(card.word, card.definition_ja);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      haptic("light");
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  }, [card]);

  const rate = useCallback(
    (r: Rating) => {
      if (!card) return;
      if (!revealed) return;
      const cardId = card.id;

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

      const willFinish = r !== 0 && queue.length <= 1;

      // Same Again-rotation behavior as the word lane: keep failed cards
      // a few slots back so they re-surface within the session.
      setQueue((q) => {
        const [head, ...rest] = q;
        if (!head) return q;
        if (r === 0) {
          const insertAt = Math.min(rest.length, 3);
          return [
            ...rest.slice(0, insertAt),
            head,
            ...rest.slice(insertAt),
          ];
        }
        return rest;
      });

      if (willFinish) {
        setFinishedAt(Date.now());
        haptic("heavy");
        confetti({
          particleCount: 120,
          spread: 80,
          startVelocity: 45,
          origin: { x: 0.5, y: 0.7 },
          colors: ["#4f46e5", "#818cf8", "#a78bfa", "#f97316", "#10b981"],
        });
      }

      setTimeout(() => {
        const p = grade(cardId, r, "normal").catch((e) => {
          console.error("grade failed", e);
        });
        if (willFinish) p.finally(() => router.refresh());
      }, 0);
    },
    [card, queue.length, revealed, router]
  );

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
      <SessionSummary
        counts={counts}
        durationMs={(finishedAt ?? Date.now()) - startRef.current}
        total={totalDue}
        gradedTodayBefore={gradedTodayBefore}
      />
    );
  }

  const remaining = queue.length;
  const done = Math.max(0, totalDue - remaining);
  const progress = totalDue > 0 ? Math.min(100, (done / totalDue) * 100) : 0;

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
              className="h-full bg-violet-500 transition-[width] duration-200 ease-out"
            />
          </div>
          <span className="h-6 px-2 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-300 inline-flex items-center gap-1">
            <Mic size={10} />
            夜の練習
          </span>
          <span className="text-[10px] text-muted tabular-nums w-7 text-right">
            {remaining}
          </span>
        </div>
      </div>

      {/* Card area */}
      <main className="flex-1 max-w-xl mx-auto w-full px-4 pb-32 flex flex-col">
        <article
          key={card.id}
          className="flex-1 flex flex-col items-center justify-center gap-3 py-5"
        >
          {/* Front: situation / Japanese note */}
          <div className="flex flex-col items-center gap-2 w-full max-w-md">
            <span className="text-[9px] uppercase tracking-widest text-muted">
              場面 / 状況
            </span>
            <div className="rounded-2xl bg-surface-2 px-4 py-4 border-l-2 border-violet-500 w-full">
              <p className="text-lg sm:text-xl font-semibold leading-snug tracking-tight">
                {card.definition_ja}
              </p>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                className="w-full max-w-md flex flex-col gap-2 mt-1"
              >
                {/* Back: English expression */}
                <div className="rounded-2xl bg-violet-500/10 dark:bg-violet-500/15 px-4 py-4 flex flex-col gap-2">
                  <span className="text-[9px] uppercase tracking-widest text-violet-700 dark:text-violet-300 font-semibold">
                    対象表現
                  </span>
                  <div className="flex items-start gap-2">
                    <p className="text-xl sm:text-2xl font-semibold leading-snug tracking-tight flex-1">
                      {card.word}
                    </p>
                    <button
                      onClick={() => speak(card.word)}
                      aria-label="発音を聞く"
                      className="w-8 h-8 rounded-full bg-background/70 flex items-center justify-center active:scale-95 hover:opacity-90 transition shrink-0"
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                </div>

                {/* ChatGPT roleplay button */}
                <button
                  type="button"
                  onClick={copyRoleplayPrompt}
                  className="rounded-xl border border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 px-4 py-3 flex items-center gap-2.5 text-left active:scale-[0.99] transition"
                >
                  <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    {copied ? (
                      <Check
                        size={15}
                        className="text-violet-700 dark:text-violet-300"
                      />
                    ) : (
                      <Copy
                        size={15}
                        className="text-violet-700 dark:text-violet-300"
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-[12px] font-semibold text-violet-700 dark:text-violet-300">
                      {copied
                        ? "コピー完了 — ChatGPT音声で貼って練習"
                        : "ChatGPT音声で練習する"}
                    </span>
                    <span className="text-[10px] text-muted leading-relaxed">
                      ロールプレイ用プロンプトをクリップボードにコピー。練習後にAgain/Good/Easyを押す。
                    </span>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </article>
      </main>

      {/* Bottom action */}
      <div className="fixed bottom-16 left-0 right-0 z-20 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-3">
        <div className="max-w-xl mx-auto px-4">
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="w-full h-11 rounded-xl bg-violet-600 text-white font-medium text-sm active:scale-[0.98] transition shadow-[0_8px_24px_-10px_rgba(139,92,246,0.6)]"
            >
              対象表現を表示
              <span className="ml-2 text-[10px] opacity-70">Space</span>
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
  gradedTodayBefore,
}: {
  counts: Counts;
  durationMs: number;
  total: number;
  gradedTodayBefore: number;
}) {
  const reviewed = counts.again + counts.hard + counts.good + counts.easy;
  const keptRate = reviewed
    ? Math.round(((counts.good + counts.easy + counts.hard) / reviewed) * 100)
    : 0;
  const todayTotal = gradedTodayBefore + reviewed;

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 min-h-svh flex-col items-center gap-5 p-6 pb-24"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-8">
        <div className="text-5xl">🌙</div>
        <div className="text-center">
          <p className="text-xl font-semibold">夜の練習 完了</p>
          <p className="text-xs text-muted mt-0.5">
            {reviewed}/{total} 完了 · {formatDuration(durationMs)}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            今日の累計 {todayTotal} / {DAILY_EXPRESSION_TARGET}
          </p>
        </div>

        <div className="w-full grid grid-cols-4 gap-1.5">
          <Chip
            label="Again"
            value={counts.again}
            color="bg-red-500/10 text-red-600 dark:text-red-400"
          />
          <Chip
            label="Hard"
            value={counts.hard}
            color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
          <Chip
            label="Good"
            value={counts.good}
            color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <Chip
            label="Easy"
            value={counts.easy}
            color="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          />
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-border bg-surface-2 text-[9px] font-mono">
      {children}
    </kbd>
  );
}
