-- CEFR difficulty tag per card. Assigned by Claude at ingest and usable for
-- vocab-size estimation and level filtering.
alter table public.cards
  add column if not exists difficulty text
    check (difficulty in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
