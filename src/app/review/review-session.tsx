"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Sparkles,
  Volume2,
} from "lucide-react";
import confetti from "canvas-confetti";
import type {
  Card,
  DeepDive,
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
  const [queue, setQueue] = useState<Card[]>(initialQueue);
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

  const card = queue[0] as Card | undefined;

  const againStreakRef = useRef<Map<string, number>>(new Map());
  const similarMapRef = useRef<
    Map<
      string,
      {
        id: string;
        word: string;
        definition_ja: string;
        part_of_speech: string | null;
        reading: string | null;
        reason: string;
      }[]
    >
  >(new Map());
  const [similarTick, setSimilarTick] = useState(0);
  const [similarBusyId, setSimilarBusyId] = useState<string | null>(null);

  const fetchSimilar = useCallback(async (cardId: string) => {
    if (similarMapRef.current.has(cardId)) return;
    setSimilarBusyId(cardId);
    try {
      const res = await fetch(`/api/cards/${cardId}/similar`);
      if (!res.ok) throw new Error(`similar ${res.status}`);
      const data = await res.json();
      similarMapRef.current.set(cardId, data.similar ?? []);
      setSimilarTick((t) => t + 1);
    } catch (e) {
      console.error("similar fetch failed", e);
    } finally {
      setSimilarBusyId((id) => (id === cardId ? null : id));
    }
  }, []);

  const rate = useCallback(
    (r: Rating) => {
      if (!revealed || !card) return;
      const cardId = card.id;

      haptic(r === 0 ? "again" : r === 1 ? "medium" : r === 2 ? "good" : "light");
      setFlash(r);
      setTimeout(() => setFlash(null), 280);

      const streakMap = againStreakRef.current;
      if (r === 0) {
        const next = (streakMap.get(cardId) ?? 0) + 1;
        streakMap.set(cardId, next);
        if (next >= 2) {
          fetchSimilar(cardId).catch(() => {});
        }
      } else {
        streakMap.delete(cardId);
      }

      setCounts((c) => ({
        again: c.again + (r === 0 ? 1 : 0),
        hard: c.hard + (r === 1 ? 1 : 0),
        good: c.good + (r === 2 ? 1 : 0),
        easy: c.easy + (r === 3 ? 1 : 0),
      }));

      setRevealed(false);

      const willFinish = r !== 0 && queue.length <= 1;

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
          colors: ["#4f46e5", "#818cf8", "#f97316", "#fbbf24", "#10b981"],
        });
      }

      setTimeout(() => {
        const p = grade(cardId, r).catch((e) => {
          console.error("grade failed", e);
        });
        if (willFinish) p.finally(() => router.refresh());
      }, 0);
    },
    [card, queue.length, revealed, router, fetchSimilar]
  );

  const speak = useCallback((text: string) => {
    if (!text) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  const speakWord = useCallback(() => {
    if (card) speak(card.word);
  }, [card, speak]);

  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    if (!card) return;
    if (autoPlay) return;
    if (cloze && !revealed) return;
    speak(card.word);
  }, [card, revealed, cloze, autoPlay, speak]);

  useEffect(() => {
    if (!autoPlay || !card) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms));
    const utter = (text: string, lang: "en-US" | "ja-JP", rate = 0.95) =>
      new Promise<void>((resolve) => {
        if (!text) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      });

    window.speechSynthesis.cancel();
    (async () => {
      setRevealed(false);
      await sleep(250);
      if (cancelled) return;
      await utter(card.word, "en-US", 0.9);
      if (cancelled) return;
      await sleep(350);
      if (cancelled) return;
      setRevealed(true);
      await utter(card.definition_ja, "ja-JP", 1.0);
      if (cancelled) return;
      if (card.example_en) {
        await sleep(250);
        await utter(card.example_en, "en-US", 0.95);
      }
      if (cancelled) return;
      if (card.example_ja) {
        await utter(card.example_ja, "ja-JP", 1.0);
      }
      if (cancelled) return;
      await sleep(1200);
      if (cancelled) return;
      // Rotate instead of removing: keep the card in the due queue so this
      // listening pass doesn't affect SRS progress or the remaining count.
      setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
    })();

    return () => {
      cancelled = true;
      window.speechSynthesis.cancel();
    };
  }, [autoPlay, card?.id]);

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

  const [deepDiveBusyId, setDeepDiveBusyId] = useState<string | null>(null);

  const requestDeepDive = useCallback(
    async (cardId: string, regenerate = false) => {
      if (deepDiveBusyId) return;
      setDeepDiveBusyId(cardId);
      try {
        const res = await fetch(`/api/cards/${cardId}/deep-dive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate }),
        });
        if (!res.ok) throw new Error(`deep-dive ${res.status}`);
        const data = (await res.json()) as { deep_dive: DeepDive };
        setQueue((q) =>
          q.map((c) =>
            c.id === cardId ? { ...c, deep_dive: data.deep_dive } : c
          )
        );
      } catch (e) {
        console.error(e);
      } finally {
        setDeepDiveBusyId(null);
      }
    },
    [deepDiveBusyId]
  );

  const clozeFront = useMemo(() => {
    if (!card || !cloze || !card.example_en) return null;
    return clozeSentence(card.example_en, card.word);
  }, [card, cloze]);

  if (!card) {
    return (
      <SessionSummary
        counts={counts}
        durationMs={(finishedAt ?? Date.now()) - startRef.current}
        total={totalDue}
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
              className="h-full bg-accent transition-[width] duration-200 ease-out"
            />
          </div>
          <button
            type="button"
            onClick={() => setAutoPlay((v) => !v)}
            aria-pressed={autoPlay}
            aria-label={autoPlay ? "自動再生を停止" : "自動再生"}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition active:scale-95 ${
              autoPlay
                ? "bg-accent text-accent-foreground"
                : "bg-surface-2 text-muted"
            }`}
          >
            {autoPlay ? <Pause size={11} /> : <Play size={11} />}
          </button>
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
        <article
          key={card.id}
          className="flex-1 flex flex-col items-center justify-center gap-3 py-5"
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
                  onClick={speakWord}
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
                        onClick={speakWord}
                        aria-label="発音を聞く"
                        className="w-7 h-7 rounded-full bg-background flex items-center justify-center active:scale-95 hover:opacity-90 transition"
                      >
                        <Volume2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl bg-surface-2 px-4 py-3.5 flex flex-col gap-1.5 border-l-2 border-accent">
                  <div className="text-lg sm:text-xl font-semibold leading-snug tracking-tight">
                    {card.definition_ja}
                  </div>
                  {card.definition_en && (
                    <div className="text-[11px] text-muted leading-relaxed">
                      {card.definition_en}
                    </div>
                  )}
                </div>
                {card.example_en && !cloze && (
                  <button
                    type="button"
                    onClick={() => speak(card.example_en!)}
                    aria-label="例文を読み上げ"
                    className="rounded-xl border border-border p-4 flex flex-col gap-1 text-left active:scale-[0.99] active:bg-surface-2 transition relative"
                  >
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center opacity-70">
                      <Volume2 size={11} />
                    </div>
                    <p className="text-sm leading-relaxed pr-7">
                      {card.example_en}
                    </p>
                    {card.example_ja && (
                      <p className="text-[11px] text-muted leading-relaxed">
                        {card.example_ja}
                      </p>
                    )}
                  </button>
                )}
                {card.etymology && (
                  <div className="rounded-lg px-3 py-2 flex gap-2 bg-surface-2/40">
                    <BookOpen
                      size={11}
                      className="text-muted shrink-0 mt-0.5 opacity-70"
                    />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[8px] uppercase tracking-widest text-muted font-semibold">
                        語源
                      </span>
                      <p className="text-[11px] leading-relaxed text-muted">
                        {card.etymology}
                      </p>
                    </div>
                  </div>
                )}
                {card.related_words && card.related_words.length > 0 && (
                  <RelatedWordsPanel items={card.related_words} />
                )}
                {card.extra_examples && card.extra_examples.length > 0 && (
                  <ExtraExamplesPanel items={card.extra_examples} onSpeak={speak} />
                )}
                {(againStreakRef.current.get(card.id) ?? 0) >= 2 && (
                  <SimilarPanel
                    cards={similarMapRef.current.get(card.id) ?? []}
                    busy={similarBusyId === card.id}
                    tick={similarTick}
                  />
                )}
                <DeepDiveSection
                  cardId={card.id}
                  deepDive={card.deep_dive}
                  busy={deepDiveBusyId === card.id}
                  onRequest={requestDeepDive}
                />
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
    <div className="rounded-lg px-3 py-2 flex flex-col gap-1 bg-surface-2/40">
      <span className="text-[8px] uppercase tracking-widest text-muted font-semibold flex items-center gap-1">
        <GraduationCap size={10} className="opacity-70" /> Word family
      </span>
      <ul className="flex flex-col gap-0.5">
        {items.map((w, i) => (
          <li
            key={`${w.word}-${i}`}
            className="flex items-baseline gap-2 text-[11px]"
          >
            <span className="font-medium">{w.word}</span>
            {w.part_of_speech && (
              <span className="text-[9px] text-muted">{w.part_of_speech}</span>
            )}
            <span className="text-muted">{w.meaning_ja}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExtraExamplesPanel({
  items,
  onSpeak,
}: {
  items: ExtraExample[];
  onSpeak: (text: string) => void;
}) {
  const registerLabel = (r: ExtraExample["register"]) =>
    r === "formal" ? "formal" : r === "conversational" ? "casual" : r === "idiom" ? "idiom" : null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[8px] uppercase tracking-widest text-muted font-semibold px-1">
        他の例文
      </span>
      <div className="flex flex-col gap-1">
        {items.map((e, i) => {
          const reg = registerLabel(e.register);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSpeak(e.en)}
              aria-label="例文を読み上げ"
              className="rounded-lg border border-border/60 px-3 py-2.5 flex flex-col gap-0.5 text-left active:scale-[0.99] active:bg-surface-2 transition relative"
            >
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-2 flex items-center justify-center opacity-60">
                <Volume2 size={10} />
              </div>
              <div className="flex items-baseline justify-between gap-2 pr-6">
                <p className="text-[12px] leading-relaxed">{e.en}</p>
                {reg && (
                  <span className="text-[8px] uppercase tracking-widest text-muted shrink-0">
                    {reg}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted leading-relaxed">{e.ja}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SimilarPanel({
  cards,
  busy,
  tick: _tick,
}: {
  cards: {
    id: string;
    word: string;
    definition_ja: string;
    part_of_speech: string | null;
    reading: string | null;
    reason: string;
  }[];
  busy: boolean;
  tick: number;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Shuffle size={11} className="text-amber-600 dark:text-amber-400" />
        <span className="text-[9px] uppercase tracking-widest text-amber-700 dark:text-amber-400 font-semibold">
          混同の疑い · 連続Again
        </span>
      </div>
      {busy && cards.length === 0 ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Loader2 size={11} className="animate-spin" />
          似た語を探しています…
        </div>
      ) : cards.length === 0 ? (
        <p className="text-[11px] text-muted">
          似た語が見つかりませんでした。語源や使い方の違いを再確認してみてください。
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {cards.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2 text-[12px]">
                <Link
                  href={`/cards/${c.id}`}
                  className="font-semibold hover:text-accent transition shrink-0"
                >
                  {c.word}
                </Link>
                {c.part_of_speech && (
                  <span className="text-[9px] text-muted">
                    {c.part_of_speech}
                  </span>
                )}
                <span className="text-muted leading-relaxed">
                  {c.definition_ja}
                </span>
              </div>
              {c.reason && (
                <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 pl-0.5">
                  ↳ {c.reason}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeepDiveSection({
  cardId,
  deepDive,
  busy,
  onRequest,
}: {
  cardId: string;
  deepDive: DeepDive | null;
  busy: boolean;
  onRequest: (cardId: string, regenerate?: boolean) => void;
}) {
  if (!deepDive) {
    return (
      <button
        type="button"
        onClick={() => onRequest(cardId)}
        disabled={busy}
        className="rounded-xl border border-dashed border-accent/40 px-3 py-2.5 flex items-center justify-center gap-2 text-[12px] font-medium text-accent active:scale-[0.99] transition disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Sparkles size={12} />
        )}
        {busy ? "生成中…" : "最終兵器 · 語根で覚える"}
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-surface-2/60 border border-accent/20 p-3 flex flex-col gap-2.5 relative">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-accent font-semibold flex items-center gap-1">
          <Sparkles size={10} /> 最終兵器
        </span>
        <button
          type="button"
          onClick={() => onRequest(cardId, true)}
          disabled={busy}
          aria-label="再生成"
          className="w-6 h-6 rounded-full flex items-center justify-center text-muted hover:bg-surface-2 active:scale-95 transition disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <RefreshCw size={10} />
          )}
        </button>
      </div>

      {deepDive.roots.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[8px] uppercase tracking-widest text-muted font-semibold">
            語根分解
          </span>
          <div className="flex flex-col gap-0.5">
            {deepDive.roots.map((r, i) => (
              <div
                key={`${r.segment}-${i}`}
                className="flex items-baseline gap-2 text-[11px]"
              >
                <span className="font-mono font-semibold text-accent shrink-0">
                  {r.segment}
                </span>
                {r.origin && (
                  <span className="text-[9px] text-muted shrink-0">
                    {r.origin}
                  </span>
                )}
                <span className="text-foreground/80 leading-relaxed">
                  {r.meaning}
                </span>
              </div>
            ))}
          </div>
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
                className="flex items-baseline gap-2 text-[11px]"
              >
                <span className="font-semibold min-w-[72px]">{c.word}</span>
                <span className="text-muted leading-relaxed">{c.meaning_ja}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {deepDive.hook && (
        <p className="text-[11px] leading-relaxed text-foreground/90 border-t border-accent/15 pt-2">
          💡 {deepDive.hook}
        </p>
      )}
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
