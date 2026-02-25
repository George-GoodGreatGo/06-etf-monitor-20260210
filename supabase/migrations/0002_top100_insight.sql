create table if not exists public.top100_insight (
  data_date date primary key,
  snapshot_at timestamptz,
  source text,
  rows jsonb not null,
  markdown text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.top100_insight enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'top100_insight'
      and policyname = 'public read'
  ) then
    create policy "public read"
      on public.top100_insight
      for select
      to anon
      using (true);
  end if;
end $$;

