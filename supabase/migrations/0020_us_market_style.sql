create table if not exists public.us_market_style_snapshot (
  id text primary key check (id = 'default'),
  data_date date not null,
  fetched_at timestamptz not null,
  payload jsonb not null,
  previous_payload jsonb,
  updated_at timestamptz not null default now()
);

alter table public.us_market_style_snapshot enable row level security;
drop policy if exists "read us market style snapshot" on public.us_market_style_snapshot;
create policy "read us market style snapshot"
  on public.us_market_style_snapshot for select to anon, authenticated
  using (id = 'default');
grant select on public.us_market_style_snapshot to anon, authenticated;
grant all on public.us_market_style_snapshot to service_role;
revoke insert, update, delete on public.us_market_style_snapshot from anon, authenticated;

create or replace function public.publish_us_market_style(p_snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (p_snapshot->>'dataDate')::date;
  v_fetched timestamptz := (p_snapshot->>'fetchedAt')::timestamptz;
  v_ticker text;
  v_series jsonb;
begin
  if p_snapshot->>'benchmarkTicker' is distinct from 'SCHD'
     or p_snapshot->>'priceBasis' is distinct from 'dividend-and-split-adjusted'
     or p_snapshot->>'version' is distinct from '1'
     or v_date is null or v_fetched is null
     or jsonb_array_length(p_snapshot->'items') is distinct from 5 then
    raise exception 'Invalid US style snapshot';
  end if;
  foreach v_ticker in array array['VYM', 'VIG', 'VGT', 'VOO', 'QQQM'] loop
    v_series := p_snapshot->'seriesByTicker'->v_ticker;
    if v_series is null or jsonb_array_length(v_series) < 252
       or (v_series->-1->>'date')::date is distinct from v_date then
      raise exception 'Incomplete US style history for %', v_ticker;
    end if;
  end loop;
  perform pg_advisory_xact_lock(hashtext('publish_us_market_style'));
  if exists (
    select 1 from public.us_market_style_snapshot
    where data_date > v_date or (data_date = v_date and fetched_at > v_fetched)
  ) then
    raise exception 'Refusing older US style snapshot';
  end if;
  insert into public.us_market_style_snapshot(id, data_date, fetched_at, payload)
  values ('default', v_date, v_fetched, p_snapshot)
  on conflict (id) do update set
    previous_payload = us_market_style_snapshot.payload,
    payload = excluded.payload,
    data_date = excluded.data_date,
    fetched_at = excluded.fetched_at,
    updated_at = now();
end;
$$;

revoke execute on function public.publish_us_market_style(jsonb) from public, anon, authenticated;
grant execute on function public.publish_us_market_style(jsonb) to service_role;
