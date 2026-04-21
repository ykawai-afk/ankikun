"use client";

import { useEffect } from "react";

function classForHour(h: number): string {
  if (h >= 6 && h < 11) return "tod-morning";
  if (h >= 11 && h < 17) return "tod-afternoon";
  if (h >= 17 && h < 22) return "tod-evening";
  return "tod-night";
}

export function TodProvider() {
  useEffect(() => {
    function apply() {
      const cls = classForHour(new Date().getHours());
      const el = document.documentElement;
      el.classList.remove(
        "tod-morning",
        "tod-afternoon",
        "tod-evening",
        "tod-night"
      );
      el.classList.add(cls);
    }
    apply();
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
