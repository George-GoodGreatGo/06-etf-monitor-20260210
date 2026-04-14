create table if not exists public.market_board_point (
  data_date date primary key,
  fetched_at timestamptz not null,
  source_type text,
  source text,
  notes jsonb,
  close double precision not null,
  amount double precision,
  tr double precision,
  north_money double precision,
  amount_pct double precision,
  tr_pct double precision,
  north_pct double precision,
  v5 double precision,
  v5_pct double precision,
  pe double precision,
  earnings_yield double precision,
  yield10y_pct double precision,
  equity_bond_value double precision,
  equity_bond_pct double precision,
  updated_at timestamptz not null default now()
);

create index if not exists market_board_point_data_date_desc_idx on public.market_board_point (data_date desc);

alter table public.market_board_point enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'market_board_point'
      and policyname = 'public read'
  ) then
    create policy "public read"
      on public.market_board_point
      for select
      to anon
      using (true);
  end if;
end $$;

