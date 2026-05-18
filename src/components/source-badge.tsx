// Visual marker that surfaces where a card came from so the user can
// tell at a glance whether they're reviewing a Claude Code chat
// keeper, a bulk curriculum entry, or a cognate-trap pair.

type Variant = {
  label: string;
  /** Tailwind classes for the colored chip. */
  tone: string;
  /** Optional leading emoji/glyph. */
  glyph?: string;
};

const VARIANTS: Record<string, Variant> = {
  "chat-organic": {
    label: "Claude Code",
    tone:
      "bg-accent-soft text-accent border border-accent/30",
    glyph: "💬",
  },
  "cognate-trap": {
    label: "混同ペア",
    tone:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30",
    glyph: "⚠️",
  },
  derivation: {
    label: "派生",
    tone:
      "bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/30",
    glyph: "🌱",
  },
  "c1-curriculum-2026": {
    label: "C1 curriculum",
    tone:
      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
  },
  tetsubeki: {
    label: "鉄壁",
    tone:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30",
  },
  awl: {
    label: "AWL",
    tone:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  },
};

export function SourceBadge({
  curriculumSource,
  derivationType,
  size = "sm",
}: {
  curriculumSource: string | null;
  derivationType: string | null;
  size?: "sm" | "xs";
}) {
  // derivation_type takes precedence — a cognate-trap card with
  // curriculum_source="cognate-trap" should still surface as the trap.
  const key =
    derivationType === "cognate-trap"
      ? "cognate-trap"
      : derivationType === "family"
        ? "derivation"
        : curriculumSource;
  if (!key) return null;
  const v = VARIANTS[key];
  if (!v) return null;
  const padding = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full uppercase tracking-wider font-semibold ${padding} ${v.tone}`}
    >
      {v.glyph && <span aria-hidden>{v.glyph}</span>}
      {v.label}
    </span>
  );
}
