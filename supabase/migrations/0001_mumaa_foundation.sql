create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'MUMAA',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create unique index if not exists memberships_one_active_space
  on public.memberships (space_id, user_id)
  where status = 'active';

create table if not exists public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  invited_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (invited_email = lower(invited_email))
);

create index if not exists memberships_space_status_idx
  on public.memberships (space_id, status);

create index if not exists invitations_active_idx
  on public.space_invitations (space_id, invited_email)
  where accepted_at is null and revoked_at is null;

create or replace function public.is_allowed_mumaa_email(email text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select lower(email) in (
    'joshuajohnr1@gmail.com',
    'annacelestial001@gmail.com'
  );
$$;

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.memberships
    where space_id = target_space_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.memberships enable row level security;
alter table public.space_invitations enable row level security;

create policy "Members can read their profiles"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships own_membership
      join public.memberships target_membership
        on target_membership.space_id = own_membership.space_id
      where own_membership.user_id = auth.uid()
        and own_membership.status = 'active'
        and target_membership.user_id = profiles.id
        and target_membership.status = 'active'
    )
  );

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Members can read their space"
  on public.spaces for select to authenticated
  using (public.is_space_member(id));

create policy "Users can create a space for themselves"
  on public.spaces for insert to authenticated
  with check (created_by = auth.uid());

create policy "Members can read memberships in their space"
  on public.memberships for select to authenticated
  using (public.is_space_member(space_id));

create policy "Owners can read their invitations"
  on public.space_invitations for select to authenticated
  using (
    exists (
      select 1
      from public.memberships
      where memberships.space_id = space_invitations.space_id
        and memberships.user_id = auth.uid()
        and memberships.role = 'owner'
        and memberships.status = 'active'
    )
  );
