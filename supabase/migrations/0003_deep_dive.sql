-- "最終兵器" deep dive: root breakdown + cognate network + memory hook
alter table public.cards
  add column if not exists deep_dive jsonb;
