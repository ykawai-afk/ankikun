-- Ankikun schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)

create extension if not exists "uuid-ossp";

-- =========================
-- cards: 単語カード本体 + SM-2状態
-- =========================
create table if not exists public.cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,

  word text not null,
  reading text,
  part_of_speech text,
  definition_ja text not null,
  definition_en text,
  example_en text,
  example_ja text,

  source_image_path text,
  source_context text,
  etymology text,
  user_note text,
  audio_url text,

  -- SM-2 state
  ease_factor real not null default 2.5,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  status text not null default 'new'
    check (status in ('new','learning','review','suspended')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_user_next_review_idx
  on public.cards(user_id, next_review_at)
  where status <> 'suspended';

create index if not exists cards_user_word_idx
  on public.cards(user_id, word);

-- =========================
-- review_logs: 回答履歴
-- =========================
create table if not exists public.review_logs (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 0 and 3),
  prev_interval integer not null,
  new_interval integer not null,
  prev_ease real not null,
  new_ease real not null,
  reviewed_at timestamptz not null default now()
);

create index if not exists review_logs_card_idx
  on public.review_logs(card_id, reviewed_at desc);

create index if not exists review_logs_user_idx
  on public.review_logs(user_id, reviewed_at desc);

-- =========================
-- ingestions: スクショ投入ログ
-- =========================
create table if not exists public.ingestions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  status text not null default 'pending'
    check (status in ('pending','processed','failed')),
  raw_response jsonb,
  cards_created integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists ingestions_user_idx
  on public.ingestions(user_id, created_at desc);

-- =========================
-- updated_at 自動更新トリガ
-- =========================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- =========================
-- RLS
-- =========================
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;
alter table public.ingestions enable row level security;

drop policy if exists cards_select_own on public.cards;
drop policy if exists cards_insert_own on public.cards;
drop policy if exists cards_update_own on public.cards;
drop policy if exists cards_delete_own on public.cards;

create policy cards_select_own on public.cards
  for select using (auth.uid() = user_id);
create policy cards_insert_own on public.cards
  for insert with check (auth.uid() = user_id);
create policy cards_update_own on public.cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy cards_delete_own on public.cards
  for delete using (auth.uid() = user_id);

drop policy if exists review_logs_select_own on public.review_logs;
drop policy if exists review_logs_insert_own on public.review_logs;

create policy review_logs_select_own on public.review_logs
  for select using (auth.uid() = user_id);
create policy review_logs_insert_own on public.review_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists ingestions_select_own on public.ingestions;

create policy ingestions_select_own on public.ingestions
  for select using (auth.uid() = user_id);

-- service_roleキーはRLSを迂回するのでAPIルート用の挿入/更新は別途行う

-- =========================
-- Storage bucket: screenshots (private)
-- =========================
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

drop policy if exists screenshots_select_own on storage.objects;
drop policy if exists screenshots_insert_own on storage.objects;

create policy screenshots_select_own on storage.objects
  for select using (
    bucket_id = 'screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy screenshots_insert_own on storage.objects
  for insert with check (
    bucket_id = 'screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
