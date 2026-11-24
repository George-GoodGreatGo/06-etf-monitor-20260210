alter table public.top100_insight
  add column if not exists grok_pushed_at timestamptz;
