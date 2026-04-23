# Ankikun

`mozu-inc-matching` で予定している AI ヒアリングエージェントの UX / scheduling 検証用プロトタイプ。Claude Code による開発ワークフローの dogfood も兼ねて、英単語学習アプリの形で実装した spike。

## 検証したポイント

- **構造化抽出フロー**: Claude API の structured output で、スクリーンショット / Web記事 → カード (JSON) を安定生成できるか
- **Follow-up タイミング制御**: SM-2 spaced-repetition を「再ヒアリング間隔」の最適化アルゴリズムとして評価
- **複数 UX モード比較**: front/back / 文脈空欄 / 英訳生成 / 語根グループの retrieve 精度を format 別で計測（→ hearing agent の質問形式選定に応用）
- **自動 metadata 付与**: deep_dive (語根 + cognate + mnemonic) を Sonnet で自動生成、コンテキスト強化のコスト/効果を確認

## Matching 移植時の mapping

| hearing agent 概念 | prototype 実装 |
|------|------|
| 回答抽出 | `src/lib/ingest.ts` (画像 / テキスト / URL) |
| Follow-up scheduling | `src/lib/srs.ts` (SM-2) |
| 追加質問生成 | `src/lib/deep-dive.ts` |
| 回答の定着判定 | `src/lib/mastery.ts` |
| 出題形式別 evaluation | `src/app/review/actions.ts` の format-aware bump |

## Stack

- Next.js 15 (App Router)
- Supabase (Postgres + Storage + Auth)
- Claude API (Opus / Sonnet / Haiku)
- Vercel

## Status

dogfood フェーズ。matching 側への移植は未着手。
