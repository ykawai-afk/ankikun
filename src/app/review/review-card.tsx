"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Card, Rating } from "@/lib/types";
import { grade } from "./actions";

const BUTTONS: { rating: Rating; label: string; tone: string }[] = [
  { rating: 0, label: "Again", tone: "bg-red-600 hover:bg-red-500 text-white" },
  { rating: 1, label: "Hard", tone: "bg-amber-500 hover:bg-amber-400 text-white" },
  { rating: 2, label: "Good", tone: "bg-emerald-600 hover:bg-emerald-500 text-white" },
  { rating: 3, label: "Easy", tone: "bg-sky-600 hover:bg-sky-500 text-white" },
];

export function ReviewCard({ card, remaining }: { card: Card; remaining: number }) {
  const [revealed, setRevealed] = useState(false);
  const [pending, startTransition] = useTransition();

  function rate(r: Rating) {
    startTransition(() => grade(card.id, r));
  }

  return (
    <main className="flex flex-1 flex-col items-center p-6 gap-6 max-w-xl mx-auto w-full">
      <header className="w-full flex items-center justify-between text-sm text-zinc-500">
        <Link href="/">← ホーム</Link>
        <span>残り {remaining}</span>
      </header>

      <section className="flex-1 w-full flex flex-col items-center justify-center gap-6 text-center">
        <div className="text-5xl sm:text-6xl font-semibold tracking-tight break-words">
          {card.word}
        </div>
        {card.part_of_speech && (
          <div className="text-sm text-zinc-500">{card.part_of_speech}</div>
        )}

        {revealed ? (
          <div className="flex flex-col gap-4 text-left w-full">
            {card.reading && (
              <div className="text-sm text-zinc-500">/{card.reading.replace(/\//g, "")}/</div>
            )}
            <div className="text-lg">{card.definition_ja}</div>
            {card.definition_en && (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {card.definition_en}
              </div>
            )}
            {card.example_en && (
              <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 text-sm">
                <p>{card.example_en}</p>
                {card.example_ja && (
                  <p className="text-zinc-500 mt-1">{card.example_ja}</p>
                )}
              </blockquote>
            )}
          </div>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="mt-4 h-12 px-8 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
          >
            答えを表示
          </button>
        )}
      </section>

      {revealed && (
        <footer className="w-full grid grid-cols-4 gap-2">
          {BUTTONS.map((b) => (
            <button
              key={b.rating}
              onClick={() => rate(b.rating)}
              disabled={pending}
              className={`h-14 rounded-xl font-medium transition disabled:opacity-50 ${b.tone}`}
            >
              {b.label}
            </button>
          ))}
        </footer>
      )}
    </main>
  );
}
