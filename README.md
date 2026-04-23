# Ankikun

英語学習向けの個人プロトタイプ。スクリーンショットや Web 記事から英単語を自動抽出 → SM-2 アルゴリズムで復習タイミングを管理 → 文脈 / 語根 / 英訳生成の複数モードで定着を計測する。

Claude Code を用いた開発ワークフローの dogfood を兼ねた実験プロジェクト。

## Stack

- Next.js 15 (App Router)
- Supabase (Postgres + Storage + Auth)
- Claude API (Opus / Sonnet / Haiku — use-case 別使い分け)
- Vercel

## Structure

- `src/app/` — UI pages (home / review / stats / add / cards)
- `src/lib/` — SM-2, mastery, ingest, deep-dive, streak, vocab
- `supabase/migrations/` — schema history
- `scripts/` — one-shot backfills (frequency rank / deep_dive)

## Local dev

```bash
npm install
vercel env pull .env.local --environment=production  # creds 取得
npm run dev
```
