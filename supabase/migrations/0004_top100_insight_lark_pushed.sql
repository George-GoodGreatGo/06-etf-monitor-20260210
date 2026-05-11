alter table public.top100_insight
  add column if not exists lark_pushed_at timestamptz;
