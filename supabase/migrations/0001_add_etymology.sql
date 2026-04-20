-- Add etymology column to cards
-- Run in Supabase SQL Editor

alter table public.cards
  add column if not exists etymology text;
