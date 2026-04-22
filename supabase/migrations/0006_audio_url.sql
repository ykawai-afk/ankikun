-- Native pronunciation audio from Free Dictionary API (dictionaryapi.dev).
-- When present the review player uses this MP3 instead of the browser TTS.
alter table public.cards
  add column if not exists audio_url text;
