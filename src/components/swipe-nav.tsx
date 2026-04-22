"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { setPageTransitionDirection } from "./page-transition";

// Order matches bottom-nav; swipe-left advances, swipe-right retreats.
const TABS = ["/", "/review", "/cards", "/stats"] as const;

const H_THRESHOLD = 80; // px horizontal distance required
const V_RATIO = 0.6;    // |dy| must be < V_RATIO * |dx|

export function SwipeNav() {
  const router = useRouter();
  const pathname = usePathname();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const active = useRef<boolean>(false);

  useEffect(() => {
    // Only enable swipe on the top-level tab pages. Sub-routes (card detail,
    // typing drill, leech session, /add, /bookmarklet) should keep their
    // own interactions intact.
    active.current = (TABS as readonly string[]).includes(pathname);

    // Prefetch the adjacent tab pages so swiping arrives on a warm cache.
    const idx = TABS.indexOf(pathname as (typeof TABS)[number]);
    if (idx >= 0) {
      const prev = TABS[idx - 1];
      const next = TABS[idx + 1];
      if (prev) router.prefetch(prev);
      if (next) router.prefetch(next);
    }
  }, [pathname, router]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (!active.current) return;
      // Ignore multi-touch / pinch.
      if (e.touches.length !== 1) return;
      // Ignore gestures that originate in form controls.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input, textarea, [contenteditable='true']") !== null ||
          target.closest("[data-swipe-block]") !== null)
      ) {
        startX.current = null;
        startY.current = null;
        return;
      }
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      startX.current = null;
      startY.current = null;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < H_THRESHOLD) return;
      if (absDy > absDx * V_RATIO) return;

      const idx = TABS.indexOf(pathname as (typeof TABS)[number]);
      if (idx === -1) return;
      const target =
        dx < 0
          ? TABS[Math.min(TABS.length - 1, idx + 1)]
          : TABS[Math.max(0, idx - 1)];
      if (target && target !== pathname) {
        setPageTransitionDirection(dx < 0 ? "left" : "right");
        router.push(target);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router]);

  return null;
}
