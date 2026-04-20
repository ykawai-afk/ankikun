"use client";

import { useState } from "react";
import { Image as ImageIcon, FileSpreadsheet } from "lucide-react";
import { AddForm } from "./add-form";
import { CsvForm } from "./csv-form";

type Mode = "image" | "csv";

export function ModeTabs() {
  const [mode, setMode] = useState<Mode>("image");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface-2">
        <TabBtn active={mode === "image"} onClick={() => setMode("image")}>
          <ImageIcon size={14} />
          画像
        </TabBtn>
        <TabBtn active={mode === "csv"} onClick={() => setMode("csv")}>
          <FileSpreadsheet size={14} />
          CSV
        </TabBtn>
      </div>
      {mode === "image" ? <AddForm /> : <CsvForm />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition ${
        active
          ? "bg-background shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
