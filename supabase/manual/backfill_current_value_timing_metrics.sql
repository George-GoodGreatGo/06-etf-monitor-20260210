-- One-time backfill for current visible value-timing run.
-- Safe scope: only updates rows in current_run_id, and only fills NULL metric columns.

with meta as (
  select current_run_id as run_id
  from public.value_timing_meta
  where id = 'default'
),
base as (
  select
    p.run_id,
    p.code,
    p.data_date,
    p.close,
    p.spread_pct,
    row_number() over (partition by p.run_id, p.code order by p.data_date) as rn
  from public.value_timing_index_point p
  join meta m on m.run_id = p.run_id
),
ma_calc as (
  select
    b.run_id,
    b.code,
    b.data_date,
    avg(b.close) over (
      partition by b.run_id, b.code
      order by b.data_date
      rows between 59 preceding and current row
    ) as ma60,
    avg(b.close) over (
      partition by b.run_id, b.code
      order by b.data_date
      rows between 249 preceding and current row
    ) as ma250
  from base b
),
bias_calc as (
  select
    m.run_id,
    m.code,
    m.data_date,
    m.ma60,
    m.ma250,
    case when m.ma60 is null or m.ma60 = 0 then null else (b.close - m.ma60) / m.ma60 end as bias60,
    case when m.ma250 is null or m.ma250 = 0 then null else (b.close - m.ma250) / m.ma250 end as bias250
  from ma_calc m
  join base b
    on b.run_id = m.run_id and b.code = m.code and b.data_date = m.data_date
),
bias_pct_calc as (
  select
    b1.run_id,
    b1.code,
    b1.data_date,
    (
      select
        case
          when cnt < 252 or cur is null then null
          else (le::double precision / cnt::double precision) * 100
        end
      from (
        select
          b1.bias60 as cur,
          count(*) filter (where b2.bias60 is not null) as cnt,
          count(*) filter (where b2.bias60 is not null and b2.bias60 <= b1.bias60) as le
        from base p2
        join bias_calc b2
          on b2.run_id = p2.run_id and b2.code = p2.code and b2.data_date = p2.data_date
        where p2.run_id = p1.run_id
          and p2.code = p1.code
          and p2.rn between greatest(1, p1.rn - 1259) and p1.rn
      ) s
    ) as bias_pct_3y_60,
    (
      select
        case
          when cnt < 252 or cur is null then null
          else (le::double precision / cnt::double precision) * 100
        end
      from (
        select
          b1.bias250 as cur,
          count(*) filter (where b2.bias250 is not null) as cnt,
          count(*) filter (where b2.bias250 is not null and b2.bias250 <= b1.bias250) as le
        from base p2
        join bias_calc b2
          on b2.run_id = p2.run_id and b2.code = p2.code and b2.data_date = p2.data_date
        where p2.run_id = p1.run_id
          and p2.code = p1.code
          and p2.rn between greatest(1, p1.rn - 1259) and p1.rn
      ) s
    ) as bias_pct_3y
  from base p1
  join bias_calc b1
    on b1.run_id = p1.run_id and b1.code = p1.code and b1.data_date = p1.data_date
),
spread_rank_calc as (
  select
    b1.run_id,
    b1.code,
    b1.data_date,
    (
      select
        case
          when cnt < 630 or cur is null then null
          else (le::double precision / cnt::double precision) * 100
        end
      from (
        select
          b1.spread_pct as cur,
          count(*) filter (where p2.spread_pct is not null) as cnt,
          count(*) filter (where p2.spread_pct is not null and p2.spread_pct <= b1.spread_pct) as le
        from base p2
        where p2.run_id = b1.run_id
          and p2.code = b1.code
          and p2.rn between greatest(1, b1.rn - 1259) and b1.rn
      ) s
    ) as spread_pct_rank_5y
  from base b1
),
calc as (
  select
    b.run_id,
    b.code,
    b.data_date,
    b.ma60,
    b.ma250,
    b.bias60,
    b.bias250,
    bp.bias_pct_3y_60,
    bp.bias_pct_3y,
    sr.spread_pct_rank_5y
  from bias_calc b
  join bias_pct_calc bp
    on bp.run_id = b.run_id and bp.code = b.code and bp.data_date = b.data_date
  join spread_rank_calc sr
    on sr.run_id = b.run_id and sr.code = b.code and sr.data_date = b.data_date
)
update public.value_timing_index_point t
set
  ma60 = coalesce(t.ma60, c.ma60),
  ma250 = coalesce(t.ma250, c.ma250),
  bias60 = coalesce(t.bias60, c.bias60),
  bias250 = coalesce(t.bias250, c.bias250),
  bias_pct_3y_60 = coalesce(t.bias_pct_3y_60, c.bias_pct_3y_60),
  bias_pct_3y = coalesce(t.bias_pct_3y, c.bias_pct_3y),
  spread_pct_rank_5y = coalesce(t.spread_pct_rank_5y, c.spread_pct_rank_5y),
  updated_at = now()
from calc c
where t.run_id = c.run_id
  and t.code = c.code
  and t.data_date = c.data_date
  and (
    t.ma60 is null
    or t.ma250 is null
    or t.bias60 is null
    or t.bias250 is null
    or t.bias_pct_3y_60 is null
    or t.bias_pct_3y is null
    or t.spread_pct_rank_5y is null
  );
