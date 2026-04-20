"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Play, type LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
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
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className="flex-1 h-full"
              aria-current={active ? "page" : undefined}
            >
              <NavInner active={active} label={item.label} Icon={item.icon} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavInner({
  active,
  label,
  Icon,
}: {
  active: boolean;
  label: string;
  Icon: LucideIcon;
}) {
  const { pending } = useLinkStatus();
  const highlighted = active || pending;
  return (
    <div className="flex flex-col items-center justify-center gap-1 h-full">
      <Icon
        size={22}
        strokeWidth={highlighted ? 2.5 : 1.8}
        className={`transition-colors ${
          pending ? "text-accent" : highlighted ? "text-foreground" : "text-muted"
        }`}
      />
      <span
        className={`text-[10px] tracking-wide transition-colors ${
          pending
            ? "text-accent font-medium"
            : highlighted
              ? "text-foreground font-medium"
              : "text-muted"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
