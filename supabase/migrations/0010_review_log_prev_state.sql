-- Capture the full pre-grade SRS state on every review_log so the grade
-- can be undone from the log alone (reverting interval/ease/repetitions
-- plus restoring the card's old status). prev_interval and prev_ease were
-- already stored; this fills in the remaining two fields. Nullable because
-- old rows won't have them — undo only needs to work on logs written after
-- this migration.
alter table public.review_logs
  add column if not exists prev_repetitions integer,
  add column if not exists prev_status text;
