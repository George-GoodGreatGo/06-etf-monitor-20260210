create table if not exists public.top100_latest (
  id smallint primary key,
  fetched_at timestamptz not null,
  data_date date not null,
  cached_at timestamptz,
  source text,
  notes jsonb,
  rows jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.top100_latest enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'top100_latest'
      and policyname = 'public read'
  ) then
    create policy "public read"
      on public.top100_latest
      for select
      to anon
      using (true);
  end if;
end $$;

