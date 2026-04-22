import { PageShell } from "@/components/page-shell";
import { ExternalLink, MousePointerClick } from "lucide-react";

export const dynamic = "force-dynamic";

function buildBookmarklet(origin: string, token: string): string {
  // Self-contained IIFE: grab the current selection, POST to /api/ingest/text
  // with the page URL & title, show a prominent result toast that stays long
  // enough to read, and stay on the page.
  const body = `(()=>{const s=(window.getSelection&&window.getSelection().toString())||'';if(!s||s.trim().length<5){alert('Ankikun: テキストを5文字以上選択してください');return;}const mk=(o)=>{const d=document.createElement('div');for(const k in o)d.style[k]=o[k];return d;};const box=mk({position:'fixed',top:'20px',right:'20px',zIndex:'2147483647',background:'#0f172a',color:'#fff',padding:'14px 18px',borderRadius:'14px',font:"system-ui,-apple-system,sans-serif",boxShadow:'0 12px 32px rgba(0,0,0,.35)',maxWidth:'320px',minWidth:'240px',lineHeight:'1.4',transition:'transform .25s ease,opacity .25s ease',transform:'translateY(-8px)',opacity:'0'});const title=mk({fontSize:'13px',fontWeight:'600',marginBottom:'4px',display:'flex',alignItems:'center',gap:'6px'});title.textContent='Ankikun · 送信中…';const body=mk({fontSize:'12px',opacity:'.85',whiteSpace:'pre-wrap',wordBreak:'break-word'});box.appendChild(title);box.appendChild(body);document.body.appendChild(box);requestAnimationFrame(()=>{box.style.transform='translateY(0)';box.style.opacity='1';});fetch('${origin}/api/ingest/text',{method:'POST',headers:{'Authorization':'Bearer ${token}','Content-Type':'application/json'},body:JSON.stringify({text:s,source_url:location.href,title:document.title})}).then(r=>r.json()).then(d=>{if(d.error){box.style.background='#991b1b';title.textContent='✕ 失敗';body.textContent=d.error;setTimeout(()=>{box.style.opacity='0';setTimeout(()=>box.remove(),300);},6000);return;}const n=d.cards_created||0;const words=(d.words||[]);if(n===0){box.style.background='#92400e';title.textContent='⚠ 追加なし';body.textContent='Claudeが学習価値のある単語を見つけられませんでした';}else{box.style.background='linear-gradient(135deg,#059669 0%,#10b981 100%)';title.innerHTML='<span style=\"font-size:18px\">✓</span> '+n+'枚追加しました';body.textContent=words.join(', ');}setTimeout(()=>{box.style.opacity='0';box.style.transform='translateY(-8px)';setTimeout(()=>box.remove(),300);},n>0?9000:6000);}).catch(e=>{box.style.background='#991b1b';title.textContent='✕ エラー';body.textContent=e.message;setTimeout(()=>{box.style.opacity='0';setTimeout(()=>box.remove(),300);},6000);});})();`;
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
          {/* React blocks javascript: URLs passed via JSX props as an XSS
              guard. We inject raw HTML so the browser treats the anchor as
              plain DOM, which lets drag-to-bookmark preserve the href
              verbatim. href is already percent-encoded so no further HTML
              escaping is needed for attribute safety. */}
          <div
            className="self-start"
            dangerouslySetInnerHTML={{
              __html: ready
                ? `<a href="${href}" draggable="true" class="inline-flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-sm font-semibold shadow-[0_8px_24px_-10px_var(--accent)] cursor-grab active:cursor-grabbing no-underline" style="text-decoration:none">📘 Ankikun に追加</a>`
                : `<span class="inline-flex items-center gap-2 rounded-xl bg-border text-muted px-4 py-2.5 text-sm">利用不可</span>`,
            }}
          />
          <p className="text-[10px] text-muted leading-relaxed">
            ⚠️ このリンクはこのページで <strong>クリックしても動きません</strong> (Reactがブロックする)。
            ブックマークバーに <strong>ドラッグ</strong> で登録してから、任意のページで使ってください。
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
