-- Streak-freeze mechanism: a weekly-replenished "免罪符" the user can
-- spend to mark a missed day as covered, preserving the streak count
-- through unavoidable gaps. Two tables:
--   user_state     : single row per user, tracks current balance and
--                    the timestamp of the last refill so the refill
--                    cadence is idempotent across multiple home loads.
--   frozen_days    : one row per (user, day) that the user has
--                    redeemed a freeze for. computeStreak treats these
--                    dates as covered alongside actual review_logs.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak_freezes_available integer not null default 1
    check (streak_freezes_available >= 0),
  last_freeze_refill_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.frozen_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  frozen_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists frozen_days_user_idx
  on public.frozen_days(user_id, day);
