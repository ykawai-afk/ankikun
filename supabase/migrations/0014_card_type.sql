-- card_type lane: separate "word" cards (existing single-word/phrase
-- vocabulary) from "expression" cards (longer English expressions
-- practiced via ChatGPT voice roleplay nightly). Lanes share the SM-2
-- machinery, review_logs, and ingestion pipeline; only queue selection
-- and the review UI diverge.
alter table public.cards
  add column if not exists card_type text not null default 'word'
    check (card_type in ('word', 'expression'));

-- Replace the unique-by-text index with a card_type-scoped version so a
-- "word" and an "expression" carrying the same surface text can coexist
-- without the dedup backstop tripping.
drop index if exists public.cards_user_word_unique_idx;
create unique index if not exists cards_user_type_word_unique_idx
  on public.cards (user_id, card_type, lower(word));

-- Queue index: existing cards_user_next_review_idx covers the daytime
-- word lane; this one accelerates the expression lane's nightly query.
create index if not exists cards_user_type_next_review_idx
  on public.cards (user_id, card_type, next_review_at)
  where status <> 'suspended';
