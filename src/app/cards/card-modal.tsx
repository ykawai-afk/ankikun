"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X, Pause, Play, Trash2, Save, Loader2 } from "lucide-react";
import type { CardRow } from "./cards-list";
import {
  updateCard,
  setCardStatus,
  deleteCard,
  type CardEditInput,
} from "./card-actions";

type Props = {
  card: CardRow | null;
  onClose: () => void;
};

export function CardModal({ card, onClose }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<CardEditInput | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (card) {
      setDraft({
        word: card.word,
        reading: card.reading,
        part_of_speech: card.part_of_speech,
        definition_ja: card.definition_ja,
        definition_en: null,
        example_en: null,
        example_ja: null,
      });
      setError(null);
      setConfirmingDelete(false);
    }
  }, [card]);

  if (!card || !draft) return null;

  function save() {
    if (!card || !draft) return;
    setError(null);
    startTransition(async () => {
      const r = await updateCard(card.id, draft);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function toggleSuspend() {
    if (!card) return;
    const next = card.status === "suspended" ? "review" : "suspended";
    setError(null);
    startTransition(async () => {
      const r = await setCardStatus(card.id, next);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function remove() {
    if (!card) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await deleteCard(card.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const suspended = card.status === "suspended";

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 36 }}
          className="w-full sm:max-w-lg bg-background rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-xl -mx-5 px-5 pt-1 pb-2 z-10">
            <h2 className="text-base font-semibold">カードを編集</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-2 active:scale-95 transition"
            >
              <X size={18} />
            </button>
          </header>

          <Field label="Word">
            <input
              value={draft.word}
              onChange={(e) => setDraft({ ...draft, word: e.target.value })}
              className="w-full h-10 px-3 rounded-xl bg-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reading (IPA)">
              <input
                value={draft.reading ?? ""}
                onChange={(e) => setDraft({ ...draft, reading: e.target.value })}
                placeholder="/rʌn/"
                className="w-full h-10 px-3 rounded-xl bg-surface-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </Field>
            <Field label="Part of speech">
              <input
                value={draft.part_of_speech ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, part_of_speech: e.target.value })
                }
                placeholder="noun, verb..."
                className="w-full h-10 px-3 rounded-xl bg-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </Field>
          </div>

          <Field label="意味 (必須)">
            <textarea
              value={draft.definition_ja}
              onChange={(e) =>
                setDraft({ ...draft, definition_ja: e.target.value })
              }
              rows={2}
              className="w-full p-3 rounded-xl bg-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </Field>

          {error && (
            <div className="rounded-xl bg-danger-soft text-danger text-sm p-3">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={toggleSuspend}
              disabled={pending}
              className={`flex-1 h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 ${
                suspended
                  ? "bg-success-soft text-success"
                  : "bg-surface-2 text-muted"
              }`}
            >
              {suspended ? <Play size={14} /> : <Pause size={14} />}
              {suspended ? "再開" : "suspend"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className={`flex-1 h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 ${
                confirmingDelete
                  ? "bg-danger text-white"
                  : "bg-danger-soft text-danger"
              }`}
            >
              <Trash2 size={14} />
              {confirmingDelete ? "本当に削除" : "削除"}
            </button>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="h-12 rounded-2xl bg-accent text-accent-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50 shadow-[0_10px_30px_-10px_var(--accent)]"
          >
            {pending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            保存
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted font-semibold">
        {label}
      </span>
      {children}
    </label>
  );
}
