create table if not exists public.auth_user_account (
  username text primary key,
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  password_hash text not null,
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint auth_user_account_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$')
);

create index if not exists auth_user_account_role_status_idx
  on public.auth_user_account (role, status, username);

drop trigger if exists set_auth_user_account_updated_at on public.auth_user_account;
create trigger set_auth_user_account_updated_at
before update on public.auth_user_account
for each row
execute function public.set_updated_at();

alter table public.auth_user_account enable row level security;

drop policy if exists "deny direct access to auth user accounts" on public.auth_user_account;
create policy "deny direct access to auth user accounts"
on public.auth_user_account
for all
to anon, authenticated
using (false)
with check (false);
