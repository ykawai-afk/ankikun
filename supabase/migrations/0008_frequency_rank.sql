-- Per-card English frequency rank (COCA-ish). Stored as the midpoint of a
-- 9-band ladder so Claude can classify reliably at ingest and the downstream
-- coverage model has a numeric handle. NULL = proper noun / acronym /
-- technical jargon that doesn't sit on the general-English frequency curve.
alter table public.cards
  add column if not exists frequency_rank integer
    check (frequency_rank is null or (frequency_rank > 0 and frequency_rank <= 60000));

create index if not exists cards_frequency_rank_idx
  on public.cards (user_id, frequency_rank);
