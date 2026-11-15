create or replace function public.is_space_owner(target_space_id uuid)
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
      and role = 'owner'
      and status = 'active'
  );
$$;

create or replace function public.enforce_two_active_members()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  active_member_count integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.space_id::text, 0)
  );

  select count(*) into active_member_count
  from public.memberships
  where space_id = new.space_id
    and status = 'active'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if active_member_count >= 2 then
    raise exception using
      errcode = 'check_violation',
      message = 'A MUMAA space can have at most two active members';
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_two_active_members
  on public.memberships;

create trigger memberships_two_active_members
before insert or update of space_id, status
on public.memberships
for each row
execute function public.enforce_two_active_members();

create or replace function public.prevent_author_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.author_id <> old.author_id then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Content authors cannot be changed';
  end if;
  return new;
end;
$$;

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  body text not null,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces(id) on delete cascade,
  author_id uuid references auth.users(id) on delete restrict,
  slug text not null,
  title text not null,
  excerpt text,
  body text,
  cover_image_path text,
  route text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, slug),
  check (space_id is not null or is_published = true)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'planned', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null,
  diary_entry_id uuid references public.diary_entries(id) on delete cascade,
  memory_id uuid references public.memories(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  idea_id uuid references public.ideas(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    num_nonnulls(diary_entry_id, memory_id, event_id, idea_id) = 1
  )
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null,
  file_name text not null,
  byte_size bigint not null check (byte_size >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  encrypted_body text not null,
  unlock_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.comment_target_matches_space(
  target_space_id uuid,
  target_diary_entry_id uuid,
  target_memory_id uuid,
  target_event_id uuid,
  target_idea_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when target_diary_entry_id is not null then exists (
      select 1 from public.diary_entries
      where id = target_diary_entry_id and space_id = target_space_id
    )
    when target_memory_id is not null then exists (
      select 1 from public.memories
      where id = target_memory_id and space_id = target_space_id
    )
    when target_event_id is not null then exists (
      select 1 from public.events
      where id = target_event_id and space_id = target_space_id
    )
    when target_idea_id is not null then exists (
      select 1 from public.ideas
      where id = target_idea_id and space_id = target_space_id
    )
    else false
  end;
$$;

create or replace function public.validate_comment_target()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if not public.comment_target_matches_space(
    new.space_id,
    new.diary_entry_id,
    new.memory_id,
    new.event_id,
    new.idea_id
  ) then
    raise exception using
      errcode = 'foreign_key_violation',
      message = 'Comment target must belong to the comment space';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_target_matches_space on public.comments;
create trigger comments_target_matches_space
before insert or update of space_id, diary_entry_id, memory_id, event_id, idea_id
on public.comments
for each row execute function public.validate_comment_target();

create index if not exists diary_entries_space_date_idx
  on public.diary_entries (space_id, entry_date desc);
create index if not exists memories_space_created_idx
  on public.memories (space_id, created_at desc);
create index if not exists events_space_start_idx
  on public.events (space_id, starts_at);
create index if not exists ideas_space_status_idx
  on public.ideas (space_id, status);
create index if not exists comments_space_created_idx
  on public.comments (space_id, created_at);
create index if not exists media_space_created_idx
  on public.media (space_id, created_at desc);
create index if not exists capsules_space_unlock_idx
  on public.time_capsules (space_id, unlock_at);
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

drop trigger if exists diary_entries_author_immutable on public.diary_entries;
create trigger diary_entries_author_immutable
before update of author_id on public.diary_entries
for each row execute function public.prevent_author_change();

drop trigger if exists memories_author_immutable on public.memories;
create trigger memories_author_immutable
before update of author_id on public.memories
for each row execute function public.prevent_author_change();

drop trigger if exists ideas_author_immutable on public.ideas;
create trigger ideas_author_immutable
before update of author_id on public.ideas
for each row execute function public.prevent_author_change();

drop trigger if exists comments_author_immutable on public.comments;
create trigger comments_author_immutable
before update of author_id on public.comments
for each row execute function public.prevent_author_change();

create or replace function public.create_mumaa_space(space_name text default 'MUMAA')
returns public.spaces
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_space public.spaces;
begin
  if auth.uid() is null then
    raise exception using errcode = 'insufficient_privilege', message = 'Authentication required';
  end if;

  if not public.is_allowed_mumaa_email(auth.jwt() ->> 'email') then
    raise exception using errcode = 'insufficient_privilege', message = 'Email is not allowed';
  end if;

  insert into public.spaces (name, created_by)
  values (coalesce(nullif(trim(space_name), ''), 'MUMAA'), auth.uid())
  returning * into new_space;

  insert into public.memberships (space_id, user_id, role)
  values (new_space.id, auth.uid(), 'owner');

  return new_space;
end;
$$;

create or replace function public.accept_mumaa_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invitation public.space_invitations;
  current_email text := lower(auth.jwt() ->> 'email');
  accepted_space_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'insufficient_privilege', message = 'Authentication required';
  end if;

  if not public.is_allowed_mumaa_email(current_email) then
    raise exception using errcode = 'insufficient_privilege', message = 'Email is not allowed';
  end if;

  select *
    into invitation
  from public.space_invitations
  where token_hash = invitation_token_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception using errcode = 'invalid_parameter_value', message = 'Invitation is invalid or expired';
  end if;

  if invitation.invited_email <> current_email then
    raise exception using errcode = 'insufficient_privilege', message = 'Invitation email does not match';
  end if;

  insert into public.memberships (space_id, user_id, role)
  values (invitation.space_id, auth.uid(), 'member')
  on conflict (space_id, user_id) do update
    set status = 'active';

  update public.space_invitations
  set accepted_at = now()
  where id = invitation.id
    and accepted_at is null;

  if not found then
    raise exception using errcode = 'serialization_failure', message = 'Invitation was already accepted';
  end if;

  accepted_space_id := invitation.space_id;
  return accepted_space_id;
end;
$$;

revoke all on function public.create_mumaa_space(text) from public;
grant execute on function public.create_mumaa_space(text) to authenticated;
revoke all on function public.accept_mumaa_invitation(text) from public;
grant execute on function public.accept_mumaa_invitation(text) to authenticated;

drop policy if exists "Users can create a space for themselves" on public.spaces;
drop policy if exists "Members can read their space" on public.spaces;
create policy "Members can read their space"
on public.spaces for select to authenticated
using (public.is_space_member(id));

drop policy if exists "Members can read memberships in their space" on public.memberships;
create policy "Members can read memberships in their space"
on public.memberships for select to authenticated
using (public.is_space_member(space_id));

drop policy if exists "Owners can read their invitations" on public.space_invitations;
create policy "Owners can read their invitations"
on public.space_invitations for select to authenticated
using (public.is_space_owner(space_id));

create policy "Owners can create invitations"
on public.space_invitations for insert to authenticated
with check (
  public.is_space_owner(space_id)
  and invited_email = lower(invited_email)
  and public.is_allowed_mumaa_email(invited_email)
  and created_by = auth.uid()
);

create policy "Owners can revoke invitations"
on public.space_invitations for update to authenticated
using (public.is_space_owner(space_id))
with check (public.is_space_owner(space_id));

alter table public.diary_entries enable row level security;
alter table public.memories enable row level security;
alter table public.events enable row level security;
alter table public.ideas enable row level security;
alter table public.comments enable row level security;
alter table public.media enable row level security;
alter table public.time_capsules enable row level security;
alter table public.notifications enable row level security;

create policy "Members can read diary entries"
on public.diary_entries for select to authenticated
using (public.is_space_member(space_id));
create policy "Members can create diary entries"
on public.diary_entries for insert to authenticated
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy "Authors can update diary entries"
on public.diary_entries for update to authenticated
using (public.is_space_member(space_id) and author_id = auth.uid())
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy "Authors can delete diary entries"
on public.diary_entries for delete to authenticated
using (public.is_space_member(space_id) and author_id = auth.uid());

create policy "Published or shared memories are readable"
on public.memories for select to anon, authenticated
using (is_published = true or public.is_space_member(space_id));
create policy "Members can create memories"
on public.memories for insert to authenticated
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy "Authors can update memories"
on public.memories for update to authenticated
using (public.is_space_member(space_id) and author_id = auth.uid())
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy "Authors can delete memories"
on public.memories for delete to authenticated
using (public.is_space_member(space_id) and author_id = auth.uid());

create policy "Members can read events"
on public.events for select to authenticated
using (public.is_space_member(space_id));
create policy "Members can create events"
on public.events for insert to authenticated
with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy "Creators can update events"
on public.events for update to authenticated
using (public.is_space_member(space_id) and created_by = auth.uid())
with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy "Creators can delete events"
on public.events for delete to authenticated
using (public.is_space_member(space_id) and created_by = auth.uid());

create policy "Members can read ideas"
on public.ideas for select to authenticated
using (public.is_space_member(space_id));
create policy "Members can create ideas"
on public.ideas for insert to authenticated
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy "Authors can update ideas"
on public.ideas for update to authenticated
using (public.is_space_member(space_id) and author_id = auth.uid())
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy "Authors can delete ideas"
on public.ideas for delete to authenticated
using (public.is_space_member(space_id) and author_id = auth.uid());

create policy "Members can read comments"
on public.comments for select to authenticated
using (public.is_space_member(space_id));
create policy "Members can create comments"
on public.comments for insert to authenticated
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy "Authors can update comments"
on public.comments for update to authenticated
using (public.is_space_member(space_id) and author_id = auth.uid())
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy "Authors can delete comments"
on public.comments for delete to authenticated
using (public.is_space_member(space_id) and author_id = auth.uid());

create policy "Members can read media records"
on public.media for select to authenticated
using (public.is_space_member(space_id));
create policy "Members can create media records"
on public.media for insert to authenticated
with check (public.is_space_member(space_id) and uploaded_by = auth.uid());
create policy "Uploaders can delete media records"
on public.media for delete to authenticated
using (public.is_space_member(space_id) and uploaded_by = auth.uid());

create policy "Members can read unlocked time capsules"
on public.time_capsules for select to authenticated
using (public.is_space_member(space_id) and unlock_at <= now());
create policy "Members can create time capsules"
on public.time_capsules for insert to authenticated
with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy "Creators can update locked time capsules"
on public.time_capsules for update to authenticated
using (public.is_space_member(space_id) and created_by = auth.uid() and unlock_at > now())
with check (public.is_space_member(space_id) and created_by = auth.uid() and unlock_at > now());
create policy "Creators can delete locked time capsules"
on public.time_capsules for delete to authenticated
using (public.is_space_member(space_id) and created_by = auth.uid() and unlock_at > now());

create policy "Recipients can read notifications"
on public.notifications for select to authenticated
using (recipient_id = auth.uid() and public.is_space_member(space_id));
create policy "Recipients can update notifications"
on public.notifications for update to authenticated
using (recipient_id = auth.uid() and public.is_space_member(space_id))
with check (recipient_id = auth.uid() and public.is_space_member(space_id));

create or replace function public.storage_path_space_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create policy "Members can read private MUMAA media"
on storage.objects for select to authenticated
using (
  bucket_id = 'mumaa-media'
  and public.is_space_member(public.storage_path_space_id(name))
);

create policy "Members can upload private MUMAA media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mumaa-media'
  and public.is_space_member(public.storage_path_space_id(name))
);

create policy "Members can update private MUMAA media"
on storage.objects for update to authenticated
using (
  bucket_id = 'mumaa-media'
  and public.is_space_member(public.storage_path_space_id(name))
)
with check (
  bucket_id = 'mumaa-media'
  and public.is_space_member(public.storage_path_space_id(name))
);

create policy "Members can delete private MUMAA media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'mumaa-media'
  and public.is_space_member(public.storage_path_space_id(name))
);
