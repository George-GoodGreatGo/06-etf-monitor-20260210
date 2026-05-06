alter table public.value_timing_meta enable row level security;

drop policy if exists "public read default value timing meta" on public.value_timing_meta;
create policy "public read default value timing meta"
  on public.value_timing_meta
  for select
  to anon
  using (id = 'default');

alter table public.rps_style_meta enable row level security;

drop policy if exists "public read default rps style meta" on public.rps_style_meta;
create policy "public read default rps style meta"
  on public.rps_style_meta
  for select
  to anon
  using (id = 'default');
