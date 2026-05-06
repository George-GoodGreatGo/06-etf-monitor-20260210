create table if not exists public.rps_style_point (
  run_id text not null,
  ticker text not null,
  data_date date not null,
  fetched_at timestamptz not null default now(),
  source_type text,
  source text,
  notes jsonb not null default '[]'::jsonb,
  benchmark_ticker text not null default '515080.SH',
  target_close_qfq double precision not null,
  benchmark_close_qfq double precision not null,
  rps_raw double precision not null,
  rps_ma50 double precision,
  score_pct double precision,
  updated_at timestamptz not null default now(),
  constraint rps_style_point_pk primary key (run_id, ticker, data_date)
);

create index if not exists rps_style_point_run_ticker_date_idx
  on public.rps_style_point (run_id, ticker, data_date);

create index if not exists rps_style_point_ticker_date_idx
  on public.rps_style_point (ticker, data_date);

create table if not exists public.rps_style_meta (
  id text primary key,
  current_run_id text not null,
  previous_run_id text,
  history_run_ids jsonb not null default '[]'::jsonb,
  current_data_date date,
  publish_status text not null default 'idle',
  quality_summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
declare
  v_run_id text;
begin
  select current_run_id into v_run_id from public.rps_style_meta where id = 'default';
  if v_run_id is null then
    v_run_id := md5(random()::text || clock_timestamp()::text);
    insert into public.rps_style_meta (
      id,
      current_run_id,
      previous_run_id,
      history_run_ids,
      current_data_date,
      publish_status,
      quality_summary,
      updated_at
    )
    values (
      'default',
      v_run_id,
      null,
      jsonb_build_array(v_run_id),
      null,
      'idle',
      '{}'::jsonb,
      now()
    )
    on conflict (id) do nothing;
  end if;
end
$$;

alter table public.rps_style_meta enable row level security;

drop policy if exists "public read default rps style meta" on public.rps_style_meta;
create policy "public read default rps style meta"
  on public.rps_style_meta
  for select
  to anon
  using (id = 'default');

alter table public.rps_style_point enable row level security;

drop policy if exists "public read current or history rps runs" on public.rps_style_point;
create policy "public read current or history rps runs"
  on public.rps_style_point
  for select
  to anon
  using (
    run_id in (
      select current_run_id
      from public.rps_style_meta
      where id = 'default'
      union
      select jsonb_array_elements_text(history_run_ids)
      from public.rps_style_meta
      where id = 'default'
    )
  );

create or replace function public.publish_rps_run(
  p_next_run_id text,
  p_previous_run_id text,
  p_keep_run_ids jsonb,
  p_current_data_date date,
  p_publish_status text,
  p_quality_summary jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_next_run_id is null or btrim(p_next_run_id) = '' then
    raise exception 'p_next_run_id is required';
  end if;

  if p_keep_run_ids is null or jsonb_typeof(p_keep_run_ids) <> 'array' or jsonb_array_length(p_keep_run_ids) = 0 then
    raise exception 'p_keep_run_ids must be non-empty json array';
  end if;

  insert into public.rps_style_meta (
    id,
    current_run_id,
    previous_run_id,
    history_run_ids,
    current_data_date,
    publish_status,
    quality_summary,
    updated_at
  )
  values (
    'default',
    p_next_run_id,
    nullif(btrim(coalesce(p_previous_run_id, '')), ''),
    p_keep_run_ids,
    p_current_data_date,
    coalesce(nullif(btrim(coalesce(p_publish_status, '')), ''), 'ready'),
    coalesce(p_quality_summary, '{}'::jsonb),
    now()
  )
  on conflict (id) do update
  set current_run_id = excluded.current_run_id,
      previous_run_id = excluded.previous_run_id,
      history_run_ids = excluded.history_run_ids,
      current_data_date = excluded.current_data_date,
      publish_status = excluded.publish_status,
      quality_summary = excluded.quality_summary,
      updated_at = now();

  delete from public.rps_style_point
  where run_id not in (
    select jsonb_array_elements_text(p_keep_run_ids)
  );
end;
$$;

revoke execute on function public.publish_rps_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.publish_rps_run(text, text, jsonb, date, text, jsonb) to service_role;
