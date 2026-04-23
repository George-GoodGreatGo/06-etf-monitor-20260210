with keep_runs as (
  select
    m.id,
    coalesce(
      (
        select jsonb_agg(run_id order by ord)
        from (
          select run_id, ord
          from (
            select distinct on (run_id) run_id, ord
            from (
              select nullif(btrim(m.current_run_id), '') as run_id, 0::bigint as ord
              union all
              select nullif(btrim(h.value), ''), h.ord
              from jsonb_array_elements_text(
                case
                  when jsonb_typeof(m.history_run_ids) = 'array' then m.history_run_ids
                  else '[]'::jsonb
                end
              ) with ordinality as h(value, ord)
              union all
              select nullif(btrim(m.previous_run_id), ''), 1000000::bigint
            ) raw
            where run_id is not null
            order by run_id, ord
          ) deduped
          order by ord
          limit 2
        ) limited
      ),
      '[]'::jsonb
    ) as keep_run_ids
  from public.market_board_meta m
  where m.id = 'default'
),
updated as (
  update public.market_board_meta m
  set history_run_ids = kr.keep_run_ids,
      previous_run_id = case when jsonb_array_length(kr.keep_run_ids) > 1 then kr.keep_run_ids ->> 1 else null end,
      updated_at = now()
  from keep_runs kr
  where m.id = kr.id
  returning kr.keep_run_ids
)
delete from public.market_board_point
where exists (
  select 1
  from updated u
  where jsonb_array_length(u.keep_run_ids) > 0
)
and run_id not in (
  select jsonb_array_elements_text(u.keep_run_ids)
  from updated u
);

with keep_runs as (
  select
    m.id,
    coalesce(
      (
        select jsonb_agg(run_id order by ord)
        from (
          select run_id, ord
          from (
            select distinct on (run_id) run_id, ord
            from (
              select nullif(btrim(m.current_run_id), '') as run_id, 0::bigint as ord
              union all
              select nullif(btrim(h.value), ''), h.ord
              from jsonb_array_elements_text(
                case
                  when jsonb_typeof(m.history_run_ids) = 'array' then m.history_run_ids
                  else '[]'::jsonb
                end
              ) with ordinality as h(value, ord)
              union all
              select nullif(btrim(m.previous_run_id), ''), 1000000::bigint
            ) raw
            where run_id is not null
            order by run_id, ord
          ) deduped
          order by ord
          limit 2
        ) limited
      ),
      '[]'::jsonb
    ) as keep_run_ids
  from public.lowvol_meta m
  where m.id = 'default'
),
updated as (
  update public.lowvol_meta m
  set history_run_ids = kr.keep_run_ids,
      previous_run_id = case when jsonb_array_length(kr.keep_run_ids) > 1 then kr.keep_run_ids ->> 1 else null end,
      updated_at = now()
  from keep_runs kr
  where m.id = kr.id
  returning kr.keep_run_ids
)
delete from public.lowvol_index_point
where exists (
  select 1
  from updated u
  where jsonb_array_length(u.keep_run_ids) > 0
)
and run_id not in (
  select jsonb_array_elements_text(u.keep_run_ids)
  from updated u
);

with keep_runs as (
  select
    m.id,
    coalesce(
      (
        select jsonb_agg(run_id order by ord)
        from (
          select run_id, ord
          from (
            select distinct on (run_id) run_id, ord
            from (
              select nullif(btrim(m.current_run_id), '') as run_id, 0::bigint as ord
              union all
              select nullif(btrim(h.value), ''), h.ord
              from jsonb_array_elements_text(
                case
                  when jsonb_typeof(m.history_run_ids) = 'array' then m.history_run_ids
                  else '[]'::jsonb
                end
              ) with ordinality as h(value, ord)
              union all
              select nullif(btrim(m.previous_run_id), ''), 1000000::bigint
            ) raw
            where run_id is not null
            order by run_id, ord
          ) deduped
          order by ord
          limit 2
        ) limited
      ),
      '[]'::jsonb
    ) as keep_run_ids
  from public.value_timing_meta m
  where m.id = 'default'
),
updated as (
  update public.value_timing_meta m
  set history_run_ids = kr.keep_run_ids,
      previous_run_id = case when jsonb_array_length(kr.keep_run_ids) > 1 then kr.keep_run_ids ->> 1 else null end,
      updated_at = now()
  from keep_runs kr
  where m.id = kr.id
  returning kr.keep_run_ids
)
delete from public.value_timing_index_point
where exists (
  select 1
  from updated u
  where jsonb_array_length(u.keep_run_ids) > 0
)
and run_id not in (
  select jsonb_array_elements_text(u.keep_run_ids)
  from updated u
);

with keep_runs as (
  select
    m.id,
    coalesce(
      (
        select jsonb_agg(run_id order by ord)
        from (
          select run_id, ord
          from (
            select distinct on (run_id) run_id, ord
            from (
              select nullif(btrim(m.current_run_id), '') as run_id, 0::bigint as ord
              union all
              select nullif(btrim(h.value), ''), h.ord
              from jsonb_array_elements_text(
                case
                  when jsonb_typeof(m.history_run_ids) = 'array' then m.history_run_ids
                  else '[]'::jsonb
                end
              ) with ordinality as h(value, ord)
              union all
              select nullif(btrim(m.previous_run_id), ''), 1000000::bigint
            ) raw
            where run_id is not null
            order by run_id, ord
          ) deduped
          order by ord
          limit 2
        ) limited
      ),
      '[]'::jsonb
    ) as keep_run_ids
  from public.rps_style_meta m
  where m.id = 'default'
),
updated as (
  update public.rps_style_meta m
  set history_run_ids = kr.keep_run_ids,
      previous_run_id = case when jsonb_array_length(kr.keep_run_ids) > 1 then kr.keep_run_ids ->> 1 else null end,
      updated_at = now()
  from keep_runs kr
  where m.id = kr.id
  returning kr.keep_run_ids
)
delete from public.rps_style_point
where exists (
  select 1
  from updated u
  where jsonb_array_length(u.keep_run_ids) > 0
)
and run_id not in (
  select jsonb_array_elements_text(u.keep_run_ids)
  from updated u
);
