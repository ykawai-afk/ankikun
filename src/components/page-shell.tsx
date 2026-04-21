import Link from "next/link";
import { Plus } from "lucide-react";
import { type ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";
import { SettingsButton } from "./settings-sheet";

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
    <div className="flex flex-col flex-1 min-h-svh pb-16">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto flex items-center justify-between h-11 px-4">
          <SettingsButton title={title ?? "Ankikun"} />
          <div className="flex items-center gap-0.5">
            {showAdd && (
              <Link
                href="/add"
                aria-label="カードを追加"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-2 active:scale-95 transition"
              >
                <Plus size={16} />
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-xl mx-auto w-full px-4">{children}</main>
    </div>
  );
}
