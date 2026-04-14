alter table public.market_board_meta
  add column if not exists history_run_ids jsonb not null default '[]'::jsonb,
  add column if not exists current_data_date date,
  add column if not exists publish_status text not null default 'idle',
  add column if not exists quality_summary jsonb not null default '{}'::jsonb;

update public.market_board_meta
set history_run_ids =
  case
    when jsonb_typeof(history_run_ids) = 'array' and jsonb_array_length(history_run_ids) > 0 then history_run_ids
    when previous_run_id is not null and btrim(previous_run_id) <> '' then jsonb_build_array(current_run_id, previous_run_id)
    else jsonb_build_array(current_run_id)
  end
where id = 'default';

drop policy if exists "public read current or previous run" on public.market_board_point;
drop policy if exists "public read current run" on public.market_board_point;

create policy "public read current or history runs"
  on public.market_board_point
  for select
  to anon
  using (
    run_id in (
      select current_run_id
      from public.market_board_meta
      where id = 'default'
      union
      select jsonb_array_elements_text(history_run_ids)
      from public.market_board_meta
      where id = 'default'
    )
  );
