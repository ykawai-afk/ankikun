"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Play } from "lucide-react";

const ITEMS = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/review", label: "復習", icon: Play },
  { href: "/cards", label: "カード", icon: Layers },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-2xl mx-auto flex items-center justify-around h-16 px-4">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full active:scale-95 transition"
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? "text-foreground" : "text-muted"}
              />
              <span
                className={`text-[10px] tracking-wide ${
                  active ? "text-foreground font-medium" : "text-muted"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
