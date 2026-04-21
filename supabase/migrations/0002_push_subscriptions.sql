-- Web Push subscriptions
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  disabled_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
