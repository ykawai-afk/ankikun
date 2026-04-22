-- Free-form personal mnemonic / memory hook written by the learner.
-- Generation effect: self-authored links consolidate faster than received ones.
alter table public.cards
  add column if not exists user_note text;
