"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { motion } from "motion/react";
import { Check, FileSpreadsheet, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { addFromCsv, type CsvCard, type CsvAddResult } from "./csv-actions";

const SUPPORTED_COLUMNS = [
  "word",
  "reading",
  "part_of_speech",
  "definition_ja",
  "definition_en",
  "example_en",
  "example_ja",
  "etymology",
] as const;

type Parsed =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ready"; rows: CsvCard[]; sample: CsvCard[]; skipped: number };

function parseCsv(text: string): Parsed {
  if (!text.trim()) return { kind: "empty" };
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (result.errors.length > 0) {
    return {
      kind: "error",
      message: `CSVパースエラー: ${result.errors[0].message}`,
    };
  }
  const missingRequired = ["word", "definition_ja"].filter(
    (c) => !(result.meta.fields ?? []).includes(c)
  );
  if (missingRequired.length > 0) {
    return {
      kind: "error",
      message: `必須カラム不足: ${missingRequired.join(", ")}`,
    };
  }
  const rows: CsvCard[] = [];
  let skipped = 0;
  for (const r of result.data) {
    const word = (r.word ?? "").trim();
    const definition_ja = (r.definition_ja ?? "").trim();
    if (!word || !definition_ja) {
      skipped++;
      continue;
    }
    rows.push({
      word,
      reading: r.reading?.trim() || null,
      part_of_speech: r.part_of_speech?.trim() || null,
      definition_ja,
      definition_en: r.definition_en?.trim() || null,
      example_en: r.example_en?.trim() || null,
      example_ja: r.example_ja?.trim() || null,
      etymology: r.etymology?.trim() || null,
    });
  }
  if (rows.length === 0) {
    return { kind: "error", message: "有効な行がありません" };
  }
  return { kind: "ready", rows, sample: rows.slice(0, 5), skipped };
}

export function CsvForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CsvAddResult | null>(null);

  const parsed = useMemo(() => parseCsv(text), [text]);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(setText);
  }

  function submit() {
    if (parsed.kind !== "ready") return;
    startTransition(async () => {
      const r = await addFromCsv(parsed.rows);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  function reset() {
    setText("");
    setResult(null);
  }

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
        <p className="text-2xl font-semibold">+{result.cardsCreated}枚 追加</p>
        <div className="flex gap-2 w-full max-w-xs">
          <button
            onClick={reset}
            className="flex-1 h-11 rounded-2xl bg-surface-2 font-medium text-sm active:scale-95 transition"
          >
            もう1回
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
      <div className="rounded-2xl bg-surface-2 p-4 text-xs text-muted leading-relaxed">
        <div className="flex items-center gap-1.5 text-foreground font-medium mb-2">
          <FileSpreadsheet size={14} /> フォーマット
        </div>
        <p>
          1行目にヘッダ行。<code>word</code> と <code>definition_ja</code>{" "}
          が必須、他は任意。
        </p>
        <p className="mt-1 font-mono break-all text-[11px] opacity-80">
          {SUPPORTED_COLUMNS.join(",")}
        </p>
      </div>

      <label className="h-10 rounded-2xl bg-surface-2 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="sr-only"
        />
        CSVファイルを選択
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`word,reading,part_of_speech,definition_ja,definition_en,example_en,example_ja\nelusive,/ɪˈluːsɪv/,adjective,つかみどころのない,...`}
        className="min-h-48 rounded-2xl bg-surface-2 p-3 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
      />

      {/* Preview / error */}
      {parsed.kind === "error" && (
        <div className="rounded-2xl bg-danger-soft text-danger text-sm p-3 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{parsed.message}</span>
        </div>
      )}
      {parsed.kind === "ready" && (
        <div className="rounded-2xl border border-border p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>プレビュー（先頭5件）</span>
            <span className="font-medium text-foreground">
              {parsed.rows.length}件{" "}
              {parsed.skipped > 0 && (
                <span className="text-muted">({parsed.skipped}件スキップ)</span>
              )}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {parsed.sample.map((r, i) => (
              <li key={i} className="py-2 flex items-baseline gap-3 text-sm">
                <span className="font-semibold truncate w-28">{r.word}</span>
                <span className="text-muted truncate flex-1">
                  {r.definition_ja}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded-2xl bg-danger-soft text-danger text-sm p-3">
          {result.error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={parsed.kind !== "ready" || pending}
        className="h-14 rounded-2xl bg-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100 shadow-[0_10px_30px_-10px_var(--accent)]"
      >
        {pending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            追加中…
          </>
        ) : parsed.kind === "ready" ? (
          <>{parsed.rows.length}件を追加</>
        ) : (
          <>カードを追加</>
        )}
      </button>
    </div>
  );
}
