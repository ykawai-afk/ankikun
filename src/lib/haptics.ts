// Thin wrapper around the Web Vibration API. iOS Safari does not support it,
// so calls are no-ops there — the per-rate colour flash still covers feedback.

type HapticKind = "light" | "medium" | "heavy" | "again" | "good";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 35,
  again: [10, 40, 20],
  good: 15,
};

export function haptic(kind: HapticKind) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as unknown as {
    vibrate?: (pattern: number | number[]) => boolean;
  };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(PATTERNS[kind]);
  } catch {
    // ignore
  }
}
