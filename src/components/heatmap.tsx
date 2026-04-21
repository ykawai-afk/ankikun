const WEEKS = 13;
const DAYS_PER_WEEK = 7;
const TOTAL = WEEKS * DAYS_PER_WEEK;

const TZ = "Asia/Tokyo";

function ymd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function shift(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
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

  return (
    <section className="rounded-xl bg-surface-2 p-3 flex flex-col gap-2">
      <header className="flex items-baseline justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-muted">
            Activity
          </span>
          <span className="text-[11px]">
            {WEEKS}週 · <span className="font-semibold">{total}</span>回 (
            {activeDays}日)
          </span>
        </div>
        <Legend />
      </header>

      <div
        className="grid grid-flow-col gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0,1fr))` }}
      >
        {columns.map((col, ci) => (
          <div key={ci} className="grid grid-rows-7 gap-[3px]">
            {col.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date} · ${cell.count}回`}
                className={`aspect-square rounded-[2px] ${LEVEL_CLASSES[levelOf(cell.count)]}`}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-0.5 text-[9px] text-muted">
      <span>少</span>
      {LEVEL_CLASSES.map((c, i) => (
        <span key={i} className={`w-2 h-2 rounded-[2px] ${c}`} />
      ))}
      <span>多</span>
    </div>
  );
}
