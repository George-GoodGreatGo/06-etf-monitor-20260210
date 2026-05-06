create table if not exists public.rps_custom_recent_search (
  user_key text not null,
  ticker text not null,
  code text not null,
  name text not null,
  updated_at timestamptz not null default now(),
  constraint rps_custom_recent_search_pk primary key (user_key, ticker)
);

create index if not exists rps_custom_recent_search_user_updated_idx
  on public.rps_custom_recent_search (user_key, updated_at desc, ticker asc);

alter table public.rps_custom_recent_search enable row level security;

create or replace function public.upsert_rps_custom_recent_search(
  p_user_key text,
  p_ticker text,
  p_code text,
  p_name text,
  p_limit integer default 10
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_key text;
  v_ticker text;
  v_code text;
  v_name text;
  v_limit integer;
begin
  v_user_key := lower(btrim(coalesce(p_user_key, '')));
  v_ticker := upper(btrim(coalesce(p_ticker, '')));
  v_code := btrim(coalesce(p_code, ''));
  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_limit := greatest(coalesce(p_limit, 10), 1);

  if v_user_key = '' then
    return;
  end if;
  if v_ticker = '' then
    return;
  end if;
  if v_code = '' then
    v_code := split_part(v_ticker, '.', 1);
  end if;
  if v_name = '' then
    v_name := v_code;
  end if;

  insert into public.rps_custom_recent_search (
    user_key,
    ticker,
    code,
    name,
    updated_at
  )
  values (
    v_user_key,
    v_ticker,
    v_code,
    v_name,
    now()
  )
  on conflict (user_key, ticker) do update
  set code = excluded.code,
      name = excluded.name,
      updated_at = excluded.updated_at;

  delete from public.rps_custom_recent_search t
  where t.user_key = v_user_key
    and (t.user_key, t.ticker) not in (
      select s.user_key, s.ticker
      from public.rps_custom_recent_search s
      where s.user_key = v_user_key
      order by s.updated_at desc, s.ticker asc
      limit v_limit
    );
end;
$$;

revoke execute on function public.upsert_rps_custom_recent_search(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.upsert_rps_custom_recent_search(text, text, text, text, integer) to service_role;
