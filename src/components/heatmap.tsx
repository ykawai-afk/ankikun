"use client";

import { useEffect, useRef, useState } from "react";

const WEEKS = 13;
const DAYS_PER_WEEK = 7;
const TOTAL = WEEKS * DAYS_PER_WEEK;

const TZ = "Asia/Tokyo";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function ymd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function shift(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatCellDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  if (todayY === y && todayM === m && todayD === d) {
    return `今日 (${weekday})`;
  }
  return `${m}/${d} (${weekday})`;
}

const LEVEL_CLASSES = [
  "bg-border/40",
  "bg-accent/25",
  "bg-accent/50",
  "bg-accent/75",
  "bg-accent",
] as const;

function buildLevelFn(counts: number[]): (n: number) => number {
  const positives = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (positives.length === 0) return () => 0;
  const map = new Map<number, number>();
  const n = positives.length;
  for (let i = 0; i < n; i++) {
    const rank = i + 1;
    const level = Math.min(4, Math.max(1, Math.ceil((rank / n) * 4)));
    map.set(positives[i], level);
  }
  return (c) => {
    if (c <= 0) return 0;
    return map.get(c) ?? 4;
  };
}

export function Heatmap({ countsByDay }: { countsByDay: Record<string, number> }) {
  const today = new Date();
  const lastCell = today;
  const firstCell = shift(lastCell, -(TOTAL - 1));

  const cells: { date: string; count: number }[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const d = shift(firstCell, i);
    const key = ymd(d);
    cells.push({ date: key, count: countsByDay[key] ?? 0 });
  }

  const columns: typeof cells[] = [];
  for (let c = 0; c < WEEKS; c++) {
    columns.push(cells.slice(c * DAYS_PER_WEEK, (c + 1) * DAYS_PER_WEEK));
  }

  const total = cells.reduce((sum, c) => sum + c.count, 0);
  const activeDays = cells.filter((c) => c.count > 0).length;
  const levelOf = buildLevelFn(cells.map((c) => c.count));

  const [active, setActive] = useState<{ date: string; count: number } | null>(
    null
  );
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!active) return;
    const onOutside = (e: PointerEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setActive(null);
    };
    window.addEventListener("pointerdown", onOutside);
    return () => window.removeEventListener("pointerdown", onOutside);
  }, [active]);

  return (
    <section
      ref={rootRef}
      className="rounded-xl bg-surface-2 p-3 flex flex-col gap-2"
    >
      <header className="flex items-baseline justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] uppercase tracking-widest text-muted">
            Activity
          </span>
          {active ? (
            <span className="text-[11px] truncate">
              <span className="text-muted">{formatCellDate(active.date)}</span>
              <span className="mx-1 text-muted">·</span>
              <span className="font-semibold tabular-nums">{active.count}</span>
              <span className="text-muted">回</span>
            </span>
          ) : (
            <span className="text-[11px]">
              {WEEKS}週 · <span className="font-semibold">{total}</span>回 (
              {activeDays}日)
            </span>
          )}
        </div>
        <Legend />
      </header>

      <div
        className="grid grid-flow-col gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0,1fr))` }}
      >
        {columns.map((col, ci) => (
          <div key={ci} className="grid grid-rows-7 gap-[3px]">
            {col.map((cell) => {
              const selected =
                active && active.date === cell.date ? true : false;
              return (
                <button
                  type="button"
                  key={cell.date}
                  onPointerEnter={() => setActive(cell)}
                  onClick={() => setActive(cell)}
                  aria-label={`${cell.date} ${cell.count}回`}
                  style={{ touchAction: "manipulation" }}
                  className={`aspect-square rounded-[2px] transition-[outline,transform] active:scale-95 ${
                    LEVEL_CLASSES[levelOf(cell.count)]
                  } ${selected ? "outline outline-2 outline-accent outline-offset-[1px]" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-0.5 text-[9px] text-muted shrink-0">
      <span>少</span>
      {LEVEL_CLASSES.map((c, i) => (
        <span key={i} className={`w-2 h-2 rounded-[2px] ${c}`} />
      ))}
      <span>多</span>
    </div>
  );
}
