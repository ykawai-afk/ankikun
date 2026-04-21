"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Link2, Loader2, X } from "lucide-react";
import { addFromUrl, type AddResult } from "./actions";

export function UrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AddResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!url.trim() || pending) return;
    const fd = new FormData();
    fd.append("url", url.trim());
    setResult(null);
    startTransition(async () => {
      const r = await addFromUrl(fd);
      setResult(r);
      if (r.ok) {
        router.refresh();
      }
    });
  }

  function reset() {
    setUrl("");
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] uppercase tracking-widest text-muted font-semibold px-1">
          URL
        </label>
        <div className="relative">
          <Link2
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="https://example.com/article"
            className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            disabled={pending}
          />
        </div>
        <p className="text-[10px] text-muted px-1 leading-relaxed">
          記事・ブログ・Wikipedia 等の英文ページに対応。本文から学習価値の高い語を抽出します。
        </p>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!url.trim() || pending}
        className="h-11 rounded-xl bg-accent text-accent-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50 shadow-[0_8px_24px_-10px_var(--accent)]"
      >
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            抽出中…
          </>
        ) : (
          <>
            カードを作成
            <ArrowRight size={14} />
          </>
        )}
      </button>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-xl p-3 flex flex-col gap-1.5 ${
              result.ok
                ? "bg-success-soft border border-success/20"
                : "bg-danger-soft border border-danger/20"
            }`}
          >
            {result.ok ? (
              <>
                <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <Check size={13} />
                  {result.cardsCreated} 枚作成
                </div>
                {result.words.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {result.words.map((w) => (
                      <span
                        key={w}
                        className="text-[10px] bg-success/10 text-success rounded-full px-2 py-0.5 font-medium"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 h-8 rounded-lg bg-background text-xs font-medium active:scale-95 transition"
                  >
                    もう1つ追加
                  </button>
                  <Link
                    href="/cards"
                    className="flex-1 h-8 rounded-lg bg-foreground text-background text-xs font-medium flex items-center justify-center active:scale-95 transition"
                  >
                    カード一覧へ
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-1.5 text-xs text-danger">
                <X size={13} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{result.error}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
