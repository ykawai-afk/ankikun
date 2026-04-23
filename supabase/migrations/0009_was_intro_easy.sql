-- Flag cards that the user rated Easy on their very first review. Those
-- are treated as "mastered" even though SM-2 only gives them a 1-day
-- interval on intro-Easy — rating Easy first-pass is itself proof the
-- user already knew the word.
alter table public.cards
  add column if not exists was_intro_easy boolean not null default false;

-- Backfill from the log table: any card that has an intro-Easy log gets
-- the flag set. `prev_interval=0 AND prev_ease=2.5` is the canonical
-- intro-log predicate; rating=3 is Easy.
update public.cards c
set was_intro_easy = true
where exists (
  select 1 from public.review_logs l
  where l.card_id = c.id
    and l.prev_interval = 0
    and l.prev_ease = 2.5
    and l.rating = 3
);
