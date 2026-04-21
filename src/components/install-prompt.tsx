"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, Share, Plus, X } from "lucide-react";

type BipPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ankikun.install.dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BipPrompt | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mqStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ??
      // iOS Safari has its own flag
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(mqStandalone);

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipod|ipad/.test(ua) && !("MSStream" in window);
    setIsIos(ios);

    const stored = window.localStorage.getItem(DISMISS_KEY);
    setDismissed(stored === "1");

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BipPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function close() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  if (installed || dismissed) return null;
  if (!isIos && !deferred) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-16 left-3 right-3 z-40 rounded-2xl bg-surface border border-border shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] p-3 flex gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#f97316] text-white flex items-center justify-center font-semibold">
          A
        </div>
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-semibold">アプリとして追加</span>
          {isIos ? (
            <span className="text-[11px] text-muted leading-snug flex items-center gap-1 flex-wrap">
              Safariで
              <Share size={11} className="inline" /> →
              <span className="inline-flex items-center gap-0.5">
                <Plus size={11} />「ホーム画面に追加」
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-muted leading-snug">
              ホーム画面からアプリみたいに起動できます
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isIos && deferred && (
            <button
              onClick={install}
              className="h-8 px-3 rounded-lg bg-accent text-accent-foreground text-xs font-semibold flex items-center gap-1 active:scale-95 transition"
            >
              <Download size={12} /> 追加
            </button>
          )}
          <button
            onClick={close}
            aria-label="閉じる"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-2 active:scale-95 transition"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
