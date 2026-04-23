"use client";

import { useRef, useState, useTransition, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ImagePlus, Loader2, Check, X, ArrowRight } from "lucide-react";
import { addFromImage, type AddResult } from "./actions";

export function AddForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(f: File) {
    if (!f.type.startsWith("image/")) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function submit() {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    startTransition(async () => {
      const r = await addFromImage(fd);
      setResult(r);
      if (r.ok) {
        // nudge router so the cards list page reflects the new items when the user goes there
        router.refresh();
      }
    });
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
  }

  // Result state
  if (result?.ok) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6 py-12"
      >
        <div className="w-20 h-20 rounded-full bg-success-soft text-success flex items-center justify-center">
          <Check size={36} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-2xl font-semibold">
            +{result.cardsCreated}枚 追加
          </p>
          {result.words.length > 0 && (
            <p className="text-sm text-muted max-w-xs text-center">
              {result.words.join(" · ")}
            </p>
          )}
          {result.skippedDuplicates.length > 0 && (
            <p className="text-[11px] text-muted/80 max-w-xs text-center mt-1">
              重複でスキップ {result.skippedDuplicates.length}件：
              {result.skippedDuplicates.join(" · ")}
            </p>
          )}
        </div>
        <div className="flex gap-2 w-full max-w-xs">
          <button
            onClick={reset}
            className="flex-1 h-11 rounded-2xl bg-surface-2 font-medium text-sm active:scale-95 transition"
          >
            もう1枚
          </button>
          <Link
            href="/cards"
            className="flex-1 h-11 rounded-2xl bg-accent text-accent-foreground font-medium text-sm flex items-center justify-center gap-1 active:scale-95 transition"
          >
            カード一覧
            <ArrowRight size={14} />
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        英単語を含む画像をアップロードすると、Claude Visionが抽出してカード化します。
      </p>

      {/* Drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-3xl border-2 border-dashed transition aspect-[4/3] flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden ${
          dragOver
            ? "border-accent bg-accent-soft"
            : "border-border hover:border-foreground/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChange}
          className="sr-only"
        />
        <AnimatePresence mode="wait">
          {preview ? (
            <motion.img
              key="preview"
              src={preview}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full object-contain bg-background"
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-muted"
            >
              <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center">
                <ImagePlus size={24} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-medium text-foreground">
                  画像をタップまたはドロップ
                </p>
                <p className="text-xs">PNG / JPEG / WebP · 10MBまで</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {preview && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              reset();
            }}
            aria-label="画像を削除"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
          >
            <X size={14} />
          </button>
        )}
      </label>

      {/* Error */}
      {result && !result.ok && (
        <div className="rounded-2xl bg-danger-soft text-danger text-sm p-3">
          {result.error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!file || pending}
        className="h-14 rounded-2xl bg-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100 shadow-[0_10px_30px_-10px_var(--accent)]"
      >
        {pending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            抽出中…（数十秒）
          </>
        ) : (
          <>抽出してカード追加</>
        )}
      </button>
    </div>
  );
}
