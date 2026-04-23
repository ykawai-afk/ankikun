"use client";

import { useState, useTransition } from "react";
import { Snowflake, Loader2 } from "lucide-react";
import { redeemStreakFreeze } from "@/app/home-actions";

export function FreezeStreakButton({ day }: { day: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await redeemStreakFreeze(day);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="group rounded-xl bg-sky-500/10 border border-sky-500/30 px-3.5 py-2.5 flex items-center gap-2 active:scale-[0.99] transition disabled:opacity-60"
      >
        {pending ? (
          <Loader2
            size={14}
            className="text-sky-600 dark:text-sky-400 shrink-0 animate-spin"
          />
        ) : (
          <Snowflake
            size={14}
            className="text-sky-600 dark:text-sky-400 shrink-0"
          />
        )}
        <div className="flex flex-col min-w-0 flex-1 text-left">
          <span className="text-[9px] uppercase tracking-widest text-sky-700 dark:text-sky-400 font-semibold">
            Streak 凍結
          </span>
          <span className="text-[12px]">
            <span className="text-muted">昨日の空白を </span>
            <span className="font-semibold">凍結ストック 1 で守る</span>
          </span>
        </div>
      </button>
      {error && (
        <span className="text-[10px] text-danger px-1">{error}</span>
      )}
    </div>
  );
}
