create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "deny direct access to rps recent search" on public.rps_custom_recent_search;
create policy "deny direct access to rps recent search"
  on public.rps_custom_recent_search
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke execute on function public.publish_market_board_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.publish_market_board_run(text, text, jsonb, date, text, jsonb) to service_role;

revoke execute on function public.publish_lowvol_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.publish_lowvol_run(text, text, jsonb, date, text, jsonb) to service_role;

revoke execute on function public.publish_value_timing_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.publish_value_timing_run(text, text, jsonb, date, text, jsonb) to service_role;

revoke execute on function public.publish_rps_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.publish_rps_run(text, text, jsonb, date, text, jsonb) to service_role;

revoke execute on function public.upsert_rps_custom_recent_search(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.upsert_rps_custom_recent_search(text, text, text, text, integer) to service_role;
