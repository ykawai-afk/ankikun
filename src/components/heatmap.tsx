// 過去の復習回数を GitHub 風のグリッドで描画するコンポーネント.
// 日本時間基準で "YYYY-MM-DD" に集計された map を受け取って固定構造で描画する.

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
  // Line up "today" on the last column.
  const lastCell = today;
  const firstCell = shift(lastCell, -(TOTAL - 1));

  const cells: { date: string; count: number }[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const d = shift(firstCell, i);
    const key = ymd(d);
    cells.push({ date: key, count: countsByDay[key] ?? 0 });
  }

  // Render column-by-column (each column = 1 week, 7 days top→bottom)
  const columns: typeof cells[] = [];
  for (let c = 0; c < WEEKS; c++) {
    columns.push(cells.slice(c * DAYS_PER_WEEK, (c + 1) * DAYS_PER_WEEK));
  }

  const total = cells.reduce((sum, c) => sum + c.count, 0);
  const activeDays = cells.filter((c) => c.count > 0).length;

  return (
    <section className="rounded-2xl bg-surface-2 p-4 flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            Activity
          </span>
          <span className="text-sm">
            過去{WEEKS}週間で <span className="font-semibold">{total}</span>{" "}
            回復習 ({activeDays}日)
          </span>
        </div>
        <Legend />
      </header>

      <div className="grid grid-flow-col gap-1" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0,1fr))` }}>
        {columns.map((col, ci) => (
          <div key={ci} className="grid grid-rows-7 gap-1">
            {col.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date} · ${cell.count}回`}
                className={`aspect-square rounded-[3px] ${levelClass(cell.count)}`}
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
    <div className="flex items-center gap-1 text-[10px] text-muted">
      <span>少</span>
      <span className="w-2.5 h-2.5 rounded-[2px] bg-border/50" />
      <span className="w-2.5 h-2.5 rounded-[2px] bg-accent/25" />
      <span className="w-2.5 h-2.5 rounded-[2px] bg-accent/55" />
      <span className="w-2.5 h-2.5 rounded-[2px] bg-accent/80" />
      <span className="w-2.5 h-2.5 rounded-[2px] bg-accent" />
      <span>多</span>
    </div>
  );
}
