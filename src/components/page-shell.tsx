import { type ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

export function PageShell({
  title,
  children,
  rightSlot,
}: {
  title?: string;
  children: ReactNode;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-svh pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-14 px-5">
          <h1 className="text-base font-semibold tracking-tight">
            {title ?? "Ankikun"}
          </h1>
          <div className="flex items-center gap-1">
            {rightSlot}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-5">{children}</main>
    </div>
  );
}
