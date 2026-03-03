create table if not exists public.top100_insight_status (
  data_date date primary key,
  status text not null check (status in ('idle', 'generating', 'ready', 'failed')),
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.top100_insight_status enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'top100_insight_status'
      and policyname = 'public read'
  ) then
    create policy "public read"
      on public.top100_insight_status
      for select
      to anon
      using (true);
  end if;
end $$;
