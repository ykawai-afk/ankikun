import Link from "next/link";
import { Plus } from "lucide-react";
import { type ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

export function PageShell({
  title,
  children,
  showAdd = true,
}: {
  title?: string;
  children: ReactNode;
  showAdd?: boolean;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-svh pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-14 px-5">
          <h1 className="text-base font-semibold tracking-tight">
            {title ?? "Ankikun"}
          </h1>
          <div className="flex items-center gap-1">
            {showAdd && (
              <Link
                href="/add"
                aria-label="カードを追加"
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-2 active:scale-95 transition"
              >
                <Plus size={20} />
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-5">{children}</main>
    </div>
  );
}
