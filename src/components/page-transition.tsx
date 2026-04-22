"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const TABS = ["/", "/review", "/cards", "/stats"] as const;

// Exposes the swipe direction so the page transition knows which way to
// slide. The SwipeNav component writes here right before triggering the
// router push, so animation and navigation stay in sync.
let pendingDirection: "left" | "right" | null = null;

export function setPageTransitionDirection(dir: "left" | "right") {
  pendingDirection = dir;
}

function tabIndex(pathname: string): number {
  return (TABS as readonly string[]).indexOf(pathname);
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prev = useRef<string>(pathname);
  const [direction, setDirection] = useState<"left" | "right" | "none">("none");

  useEffect(() => {
    if (prev.current === pathname) return;
    // Respect the swipe direction if one was set; otherwise infer from tab
    // order (tap on bottom nav).
    let dir: "left" | "right" | "none" = "none";
    if (pendingDirection) {
      dir = pendingDirection;
      pendingDirection = null;
    } else {
      const a = tabIndex(prev.current);
      const b = tabIndex(pathname);
      if (a !== -1 && b !== -1) dir = b > a ? "left" : "right";
    }
    setDirection(dir);
    prev.current = pathname;
  }, [pathname]);

  const offset = direction === "left" ? 48 : direction === "right" ? -48 : 0;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: offset }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -offset }}
        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        className="flex flex-col flex-1 min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
