"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { PushToggle } from "./push-toggle";

export function SettingsButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="設定"
        className="text-sm font-semibold tracking-tight active:opacity-70 transition"
      >
        {title}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
            >
              <header className="flex items-center justify-between px-4 pt-3 pb-2 sticky top-0 bg-background/90 backdrop-blur-xl">
                <h2 className="text-xs font-semibold tracking-tight">設定</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="閉じる"
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-2 active:scale-95 transition"
                >
                  <X size={14} />
                </button>
              </header>
              <div className="px-4 pb-6 pt-2 flex flex-col gap-3">
                <Section label="通知">
                  <PushToggle />
                </Section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] uppercase tracking-widest text-muted font-semibold px-1">
        {label}
      </span>
      {children}
    </div>
  );
}
