"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import type { Card } from "@/lib/types";
import { CardModal } from "../card-modal";
import type { CardRow } from "../cards-list";
import { setCardStatus, deleteCard } from "../card-actions";

export function CardDetailActions({ card }: { card: Card }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  function toggleSuspend() {
    const next = card.status === "suspended" ? "review" : "suspended";
    start(async () => {
      const r = await setCardStatus(card.id, next);
      if (r.ok) router.refresh();
    });
  }

  function onDelete() {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    start(async () => {
      const r = await deleteCard(card.id);
      if (r.ok) router.replace("/cards");
    });
  }

  const modalRow: CardRow = {
    id: card.id,
    word: card.word,
    reading: card.reading,
    part_of_speech: card.part_of_speech,
    definition_ja: card.definition_ja,
    status: card.status,
    next_review_at: card.next_review_at,
    created_at: card.created_at,
    source_image_path: card.source_image_path,
    etymology: card.etymology,
    user_note: card.user_note,
    tags: card.tags,
    image_url: null,
  };

  const suspended = card.status === "suspended";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={pending}
        aria-label="編集"
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-2 active:scale-95 transition disabled:opacity-50"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onClick={toggleSuspend}
        disabled={pending}
        aria-label={suspended ? "再開" : "停止"}
        className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition disabled:opacity-50 ${
          suspended ? "text-success" : "text-muted hover:bg-surface-2"
        }`}
      >
        {suspended ? <Play size={13} /> : <Pause size={13} />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="削除"
        className={`h-8 px-2 rounded-full flex items-center justify-center gap-1 text-[11px] active:scale-95 transition disabled:opacity-50 ${
          confirmDel
            ? "bg-danger text-white"
            : "text-danger hover:bg-danger-soft"
        }`}
      >
        <Trash2 size={13} />
        {confirmDel && <span>本当に</span>}
      </button>
      {editing && (
        <CardModal card={modalRow} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
