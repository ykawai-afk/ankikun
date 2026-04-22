-- Track when each push subscription last received the daily summary so the
-- cron can self-throttle even if GH Actions retries or manual dispatch fires.
alter table public.push_subscriptions
  add column if not exists last_summary_at timestamptz;
