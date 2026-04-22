import { PageShell } from "@/components/page-shell";
import { ExternalLink, GripVertical, MousePointerClick } from "lucide-react";

export const dynamic = "force-dynamic";

function buildBookmarklet(origin: string, token: string): string {
  // Self-contained IIFE: grab the current selection, POST to /api/ingest/text
  // with the page URL & title, show a compact toast, and stay on the page.
  const body = `(()=>{const s=(window.getSelection&&window.getSelection().toString())||'';if(!s||s.trim().length<5){alert('Ankikun: テキストを5文字以上選択してください');return;}const note=document.createElement('div');note.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;background:#111;color:#fff;padding:10px 14px;border-radius:10px;font:13px system-ui,-apple-system;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:280px;line-height:1.4';note.textContent='Ankikun: 送信中…';document.body.appendChild(note);fetch('${origin}/api/ingest/text',{method:'POST',headers:{'Authorization':'Bearer ${token}','Content-Type':'application/json'},body:JSON.stringify({text:s,source_url:location.href,title:document.title})}).then(r=>r.json()).then(d=>{if(d.error){note.style.background='#b00';note.textContent='Ankikun: '+d.error;}else{note.style.background='#0a7';note.textContent='Ankikun: '+(d.cards_created||0)+'枚追加 ('+(d.words||[]).slice(0,3).join(', ')+(d.words&&d.words.length>3?'…':'')+')';}setTimeout(()=>note.remove(),4500);}).catch(e=>{note.style.background='#b00';note.textContent='Ankikun: '+e.message;setTimeout(()=>note.remove(),4500);});})();`;
  return `javascript:${encodeURIComponent(body)}`;
}

export default async function BookmarkletPage() {
  const token = process.env.INGEST_TOKEN;
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? "https://ankikun.vercel.app"
    : "http://localhost:3000";
  const ready = !!token;
  const href = ready ? buildBookmarklet(origin, token!) : "#";

  return (
    <PageShell title="Bookmarklet">
      <div className="py-4 flex flex-col gap-5 pb-8">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            選択文字列を1タップでカード化
          </h2>
          <p className="text-xs text-muted leading-relaxed">
            下のボタンを <strong>ブックマークバーにドラッグ</strong>
            。任意のページで気になる英文を選択 → ボタンを押すと、Claude
            が学習価値の高い語を抽出してカード化します。
          </p>
        </section>

        {!ready && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-[11px] text-red-700 dark:text-red-400">
            INGEST_TOKEN が設定されていません。Vercel の環境変数を確認してください。
          </div>
        )}

        <section className="rounded-2xl bg-surface-2 p-4 flex flex-col gap-3">
          <span className="text-[9px] uppercase tracking-widest text-muted font-semibold">
            ドラッグ先 ↓
          </span>
          <a
            href={href}
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-sm font-semibold shadow-[0_8px_24px_-10px_var(--accent)] cursor-grab active:cursor-grabbing"
            draggable
          >
            <GripVertical size={14} className="opacity-70" />
            Ankikun に追加
          </a>
          <p className="text-[10px] text-muted leading-relaxed">
            ⚠️ クリックではなく <strong>ドラッグ</strong> してブックマークに入れてください。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold tracking-tight inline-flex items-center gap-1.5">
            <MousePointerClick size={13} /> 使い方
          </h3>
          <ol className="flex flex-col gap-1.5 text-[12px] leading-relaxed pl-4 list-decimal">
            <li>上のリンクをブックマークバーにドラッグして登録</li>
            <li>任意のページで、学習したい英語のテキストを選択</li>
            <li>ブックマーク「Ankikun に追加」をクリック</li>
            <li>右上のトーストで結果を確認 (例「3枚追加 (mitigate, cascade...)」)</li>
          </ol>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold tracking-tight inline-flex items-center gap-1.5">
            <ExternalLink size={13} /> Tips
          </h3>
          <ul className="flex flex-col gap-1 text-[11px] text-muted leading-relaxed pl-4 list-disc">
            <li>長すぎる本文は先頭18000文字に自動トリムされます</li>
            <li>抽出は Claude Opus 4.7 で 1〜8 語/回</li>
            <li>重複は無視されずそのまま追加されるので、既知語は気にせず投入して OK</li>
            <li>このページは単一ユーザー前提。URL を共有すると token が漏れます</li>
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
