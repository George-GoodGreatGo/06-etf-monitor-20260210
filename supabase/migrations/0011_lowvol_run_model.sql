create table if not exists public.lowvol_index_point (
  run_id text not null,
  code text not null,
  data_date date not null,
  fetched_at timestamptz not null default now(),
  source_type text,
  source text,
  notes jsonb not null default '[]'::jsonb,
  close double precision not null,
  ma60 double precision,
  ma250 double precision,
  bias60 double precision,
  bias250 double precision,
  bias_pct_3y_60 double precision,
  bias_pct_3y double precision,
  dividend_yield_pct double precision,
  yield10y_pct double precision,
  spread_raw_pct double precision,
  spread_smooth_pct double precision,
  spread_pct double precision,
  spread_pct_rank_3y double precision,
  spread_pct_rank_10y double precision,
  updated_at timestamptz not null default now(),
  constraint lowvol_index_point_pk primary key (run_id, code, data_date)
);

create index if not exists lowvol_index_point_run_code_date_idx
  on public.lowvol_index_point (run_id, code, data_date);

create index if not exists lowvol_index_point_code_date_idx
  on public.lowvol_index_point (code, data_date);

create table if not exists public.lowvol_meta (
  id text primary key,
  current_run_id text not null,
  previous_run_id text,
  history_run_ids jsonb not null default '[]'::jsonb,
  current_data_date date,
  publish_status text not null default 'idle',
  quality_summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.lowvol_meta (id, current_run_id, previous_run_id, history_run_ids, current_data_date, publish_status, quality_summary, updated_at)
select
  'default',
  md5('lowvol_bootstrap:' || coalesce(max(t.updated_at)::text, clock_timestamp()::text)),
  null,
  jsonb_build_array(md5('lowvol_bootstrap:' || coalesce(max(t.updated_at)::text, clock_timestamp()::text))),
  max(t.data_date)::date,
  'ready',
  jsonb_build_object('bootstrap', true),
  now()
from public.lowvol_index_daily t
where not exists (select 1 from public.lowvol_meta where id = 'default');

do $$
declare
  v_run_id text;
begin
  select current_run_id into v_run_id from public.lowvol_meta where id = 'default';
  if v_run_id is null then
    v_run_id := md5(random()::text || clock_timestamp()::text);
    insert into public.lowvol_meta (id, current_run_id, previous_run_id, history_run_ids, current_data_date, publish_status, quality_summary, updated_at)
    values ('default', v_run_id, null, jsonb_build_array(v_run_id), null, 'idle', '{}'::jsonb, now())
    on conflict (id) do nothing;
  end if;
end
$$;

insert into public.lowvol_index_point (
  run_id,
  code,
  data_date,
  fetched_at,
  source_type,
  source,
  notes,
  close,
  ma60,
  ma250,
  bias60,
  bias250,
  bias_pct_3y_60,
  bias_pct_3y,
  dividend_yield_pct,
  yield10y_pct,
  spread_raw_pct,
  spread_smooth_pct,
  spread_pct,
  spread_pct_rank_3y,
  spread_pct_rank_10y,
  updated_at
)
with latest_daily as (
  select distinct on (t.code)
    t.code,
    t.data_date,
    t.snapshot_at,
    t.source_type,
    t.source,
    t.notes,
    t.payload,
    t.updated_at
  from public.lowvol_index_daily t
  order by t.code asc, t.data_date desc, t.snapshot_at desc nulls last, t.updated_at desc nulls last
)
select
  m.current_run_id,
  t.code,
  (p->>'date')::date,
  coalesce(t.snapshot_at::timestamptz, now()),
  t.source_type,
  t.source,
  coalesce(t.notes, '[]'::jsonb),
  (p->>'close')::double precision,
  (p->>'ma60')::double precision,
  (p->>'ma250')::double precision,
  (p->>'bias60')::double precision,
  (p->>'bias250')::double precision,
  (p->>'biasPct3y60')::double precision,
  (p->>'biasPct3y')::double precision,
  (p->>'dividendYieldPct')::double precision,
  (p->>'yield10yPct')::double precision,
  (p->>'spreadRawPct')::double precision,
  (p->>'spreadSmoothPct')::double precision,
  (p->>'spreadPct')::double precision,
  (p->>'spreadPctRank3y')::double precision,
  (p->>'spreadPctRank10y')::double precision,
  coalesce(t.updated_at::timestamptz, now())
from latest_daily t
join public.lowvol_meta m on m.id = 'default'
cross join lateral jsonb_array_elements(coalesce(t.payload->'series', '[]'::jsonb)) p
where not exists (
  select 1
  from public.lowvol_index_point lp
  where lp.run_id = m.current_run_id
)
and (p->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
on conflict (run_id, code, data_date) do nothing;

alter table public.lowvol_index_point enable row level security;

drop policy if exists "public read current or history lowvol runs" on public.lowvol_index_point;
create policy "public read current or history lowvol runs"
  on public.lowvol_index_point
  for select
  to anon
  using (
    run_id in (
      select current_run_id
      from public.lowvol_meta
      where id = 'default'
      union
      select jsonb_array_elements_text(history_run_ids)
      from public.lowvol_meta
      where id = 'default'
    )
  );

create or replace function public.publish_lowvol_run(
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

  insert into public.lowvol_meta (
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

  delete from public.lowvol_index_point
  where run_id not in (
    select jsonb_array_elements_text(p_keep_run_ids)
  );
end;
$$;
