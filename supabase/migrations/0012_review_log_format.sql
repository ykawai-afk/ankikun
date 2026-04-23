-- Capture which review format produced each grading so retention can be
-- broken down per format (front/back vs cloze vs typing) and the
-- scheduler can apply format-aware rating bumps. Nullable because
-- pre-migration rows don't have the info — assume they're "normal".
alter table public.review_logs
  add column if not exists format text
    check (format is null or format in ('normal', 'cloze', 'typing'));
