-- Backstop for the application-level dedup in ingest: a unique index on
-- (user_id, lower(word)) ensures no two cards with the same normalised
-- lemma survive in the same deck even if the application logic ever
-- misses. Index is created after the one-shot cleanup that merged the
-- 80 pre-existing duplicate groups, so it applies cleanly.
create unique index if not exists cards_user_word_unique_idx
  on public.cards (user_id, lower(word));
