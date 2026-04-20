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

function levelClass(count: number): string {
  if (count === 0) return "bg-border/50";
  if (count < 3) return "bg-accent/25";
  if (count < 8) return "bg-accent/55";
  if (count < 16) return "bg-accent/80";
  return "bg-accent";
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
                className={`aspect-square rounded-[2px] ${levelClass(cell.count)}`}
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
      <span className="w-2 h-2 rounded-[2px] bg-border/50" />
      <span className="w-2 h-2 rounded-[2px] bg-accent/25" />
      <span className="w-2 h-2 rounded-[2px] bg-accent/55" />
      <span className="w-2 h-2 rounded-[2px] bg-accent/80" />
      <span className="w-2 h-2 rounded-[2px] bg-accent" />
      <span>多</span>
    </div>
  );
}
