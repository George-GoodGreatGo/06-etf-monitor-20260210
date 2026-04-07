create table if not exists public.market_board_daily (
  data_date date primary key,
  fetched_at timestamptz not null,
  source_type text,
  source text,
  notes jsonb,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.market_board_daily enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'market_board_daily'
      and policyname = 'public read'
  ) then
    create policy "public read"
      on public.market_board_daily
      for select
      to anon
      using (true);
  end if;
end $$;

