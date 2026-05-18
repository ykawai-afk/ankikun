---
name: ankikun-quiz
description: "Drive a short SRS card quiz from Ankikun in the current chat — fetch due cards via /api/cli/*, present front, play macOS audio, ask rating, post the result back. Use when the user types /ankikun-quiz, 'クイズ出して', 'フレーズドリル' or similar."
---

# Ankikun quiz

This skill turns the chat into a 3-card (default) SRS review session against the user's Ankikun deck. It's a thin orchestrator over the existing CLI API. Memory carries the bigger context — keep this file tight.

## Prereqs

- Ankikun web app reachable. Read base URL + token via [[ankikun-api-config]].
- Switch to Haiku before driving the quiz — [[feedback_quiz_model_haiku]] explains why. Suggest `/model haiku` and pause if the session is on Opus/Sonnet.

## Inputs

The skill body is optional natural-language args. Parse a card count (3 / 5 / 10) and an optional `card_type` (word / expression / phrase). Defaults: `count=3`, no card_type filter.

Examples:
- `/ankikun-quiz` → 3 mixed cards
- `/ankikun-quiz 5` → 5 mixed cards
- `/ankikun-quiz 5 phrase` → 5 expression cards
- `フレーズドリル 5` → 5 expression cards (alias)

## Flow

For each card:

1. `GET /api/cli/quiz/next?count=1&card_type=<type?>` — pull one card so the next round picks up any state change.
2. Render **front** with the framed markdown block (see [[ankikun-brainstorming-integration]] § Quiz triggers + rich-UI template for the canonical templates):
   - Word: show `card.word` + part_of_speech.
   - Expression with literal phrase in `example_en`: show cloze (`example_en` with phrase blanked) + `example_ja` hint.
   - Expression without literal (pattern, e.g. "apply X to Y"): show `definition_ja` + `example_ja`.
3. Bash `say -v "Samantha" "<word or cloze-target>"` for pronunciation.
4. Wait for user reveal cue: `Y` / `Enter` / 「答え」 / silent next message.
5. Render **back** with definition_ja + definition_en + example pair. If `derivation_type === "cognate-trap"`, surface the warning.
6. Bash `say -v "Samantha" "<example_en>"` (full sentence).
7. Ask rating via `AskUserQuestion`:
   - Header: "Rating"
   - Question: "どれくらい覚えてた？"
   - Options: Again / Hard / Good / Easy (4-option, no preview needed — keep it fast)
8. `POST /api/cli/quiz/answer` with `{card_id, rating: 0|1|2|3}`.
9. Echo a one-line result: `✓ Good → 次回 ~4日後` and continue to the next card.

After the last card, post a short summary (`✨ 5枚完走 · 平均 Good · 3枚卒業`) and exit.

## When to skip the auto-flow

- User explicitly types an answer in the cloze input → treat as production check (compare against `card.word` with the same logic as `isTypingMatch`), not as reveal signal.
- User says 「やめる」 / 「もうええ」 / `stop` → abort cleanly, do not POST partial ratings.
- API 4xx/5xx → show the error line once, do not retry destructive writes. Suggest re-running once dev server / Vercel is back.

## What this skill is NOT for

- Bulk curriculum import — use `scripts/enrich-cards.mjs` directly.
- Free-form brainstorming where corrections happen to surface — that's the standing rule in [[ankikun-brainstorming-integration]], no skill needed.
- Web-app review — `/review` and `/review/typing` are the production UI; this skill is the chat-side alternate.
