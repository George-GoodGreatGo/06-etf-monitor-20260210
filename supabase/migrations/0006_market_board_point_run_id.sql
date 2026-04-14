create table if not exists public.market_board_meta (
  id text primary key,
  current_run_id text not null,
  previous_run_id text,
  updated_at timestamptz not null default now()
);

insert into public.market_board_meta (id, current_run_id)
values ('default', 'bootstrap')
on conflict (id) do nothing;

alter table public.market_board_meta enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'market_board_meta'
      and policyname = 'public read'
  ) then
    create policy "public read"
      on public.market_board_meta
      for select
      to anon
      using (true);
  end if;
end $$;

alter table public.market_board_point
  add column if not exists run_id text not null default 'bootstrap';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'market_board_point'
      and constraint_type = 'PRIMARY KEY'
      and constraint_name = 'market_board_point_pkey'
  ) then
    alter table public.market_board_point drop constraint market_board_point_pkey;
  end if;
end $$;

alter table public.market_board_point add primary key (run_id, data_date);

drop index if exists market_board_point_data_date_desc_idx;
create index if not exists market_board_point_run_date_desc_idx on public.market_board_point (run_id, data_date desc);

drop policy if exists "public read" on public.market_board_point;
create policy "public read current run"
  on public.market_board_point
  for select
  to anon
  using (run_id = (select current_run_id from public.market_board_meta where id = 'default'));

