-- Curriculum-aware card metadata and family-pack grouping.
--
-- New columns on cards:
--   curriculum_source  -- which study source seeded this card (rosetta tag).
--                          examples: "tetsubeki" | "awl" | "discourse-markers"
--                          | "chat-organic" | "derivation" | "cognate-trap"
--   strategic_theme    -- coarse quarterly theme; nullable.
--                          examples: "academic" | "business-email" | "formal"
--   derivation_type    -- when the card came from a family expansion, this
--                          records its role in the family.
--                          examples: "family" | "cognate-trap" | "synonym"
--                          | "antonym" | "collocation"
--   family_pack_id     -- FK to family_packs; nullable. Cards that share a
--                          seed are grouped through this id.
--   wild_uses_count    -- real-world re-use counter. Bumped when the user
--                          actively uses the phrase in a Claude Code chat.
--
-- New table:
--   family_packs       -- one row per seed expansion (e.g. "articulate
--                          family"). Cards point back via family_pack_id.

create table if not exists public.family_packs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seed_card_id uuid references public.cards(id) on delete set null,
  pack_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists family_packs_user_idx
  on public.family_packs(user_id, created_at desc);

create index if not exists family_packs_seed_idx
  on public.family_packs(seed_card_id);

alter table public.family_packs enable row level security;

drop policy if exists family_packs_select_own on public.family_packs;
drop policy if exists family_packs_insert_own on public.family_packs;
drop policy if exists family_packs_update_own on public.family_packs;
drop policy if exists family_packs_delete_own on public.family_packs;

create policy family_packs_select_own on public.family_packs
  for select using (auth.uid() = user_id);
create policy family_packs_insert_own on public.family_packs
  for insert with check (auth.uid() = user_id);
create policy family_packs_update_own on public.family_packs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy family_packs_delete_own on public.family_packs
  for delete using (auth.uid() = user_id);

alter table public.cards
  add column if not exists curriculum_source text,
  add column if not exists strategic_theme text,
  add column if not exists derivation_type text
    check (derivation_type is null or derivation_type in (
      'family', 'cognate-trap', 'synonym', 'antonym', 'collocation'
    )),
  add column if not exists family_pack_id uuid references public.family_packs(id)
    on delete set null,
  add column if not exists wild_uses_count integer not null default 0
    check (wild_uses_count >= 0);

create index if not exists cards_family_pack_idx
  on public.cards(family_pack_id)
  where family_pack_id is not null;

create index if not exists cards_curriculum_source_idx
  on public.cards(user_id, curriculum_source)
  where curriculum_source is not null;
