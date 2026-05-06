create or replace function public.publish_market_board_run(
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

  insert into public.market_board_meta (
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

  delete from public.market_board_point
  where run_id not in (
    select jsonb_array_elements_text(p_keep_run_ids)
  );
end;
$$;

revoke execute on function public.publish_market_board_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.publish_market_board_run(text, text, jsonb, date, text, jsonb) to service_role;
