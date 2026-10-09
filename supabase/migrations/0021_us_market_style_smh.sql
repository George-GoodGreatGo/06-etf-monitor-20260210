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
  v_targets text[] := array['VYM', 'VIG', 'VGT', 'VOO', 'QQQM', 'SMH'];
begin
  if p_snapshot->>'benchmarkTicker' is distinct from 'SCHD'
     or p_snapshot->>'priceBasis' is distinct from 'dividend-and-split-adjusted'
     or p_snapshot->>'version' is distinct from '1'
     or v_date is null or v_fetched is null
     or jsonb_array_length(p_snapshot->'items') is distinct from cardinality(v_targets)
     or (select count(distinct item->>'ticker') from jsonb_array_elements(p_snapshot->'items') item)
        is distinct from cardinality(v_targets)::bigint then
    raise exception 'Invalid US style snapshot';
  end if;
  foreach v_ticker in array v_targets loop
    v_series := p_snapshot->'seriesByTicker'->v_ticker;
    if v_series is null or jsonb_array_length(v_series) < 252
       or (v_series->-1->>'date')::date is distinct from v_date
       or not exists (
         select 1 from jsonb_array_elements(p_snapshot->'items') item
         where item->>'ticker' = v_ticker
       ) then
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
