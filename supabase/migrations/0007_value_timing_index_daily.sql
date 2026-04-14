create table if not exists public.value_timing_index_daily (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  data_date date not null,
  snapshot_at timestamptz not null,
  source_type text,
  source text,
  notes jsonb,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists value_timing_index_daily_code_date_uq on public.value_timing_index_daily (code, data_date);
create index if not exists value_timing_index_daily_code_date_desc_idx on public.value_timing_index_daily (code asc, data_date desc);

alter table public.value_timing_index_daily enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'value_timing_index_daily'
      and policyname = 'public read'
  ) then
    create policy "public read"
      on public.value_timing_index_daily
      for select
      to anon
      using (true);
  end if;
end $$;

