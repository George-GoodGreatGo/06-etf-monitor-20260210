drop policy if exists "public read current run" on public.market_board_point;

create policy "public read current or previous run"
  on public.market_board_point
  for select
  to anon
  using (
    run_id in (
      select current_run_id from public.market_board_meta where id = 'default'
      union
      select previous_run_id from public.market_board_meta where id = 'default'
    )
  );
