-- Love letters on the Time capsules page: one of you writes to the other, optionally sealed until a date.
--
-- Same lock-down as the trading/investor tables: RLS on with no policies, so nobody reads the table
-- directly. Only the mumaa server reaches it, through the letter_*() functions below, using the
-- server-only read token, and only after it has checked the visitor is signed in. A letter sealed
-- until a future date comes back without its words, even to the person who wrote it.

create table if not exists public.love_letters (
  id uuid primary key default gen_random_uuid(),
  author_email text not null,
  author_name text not null check (length(trim(author_name)) between 1 and 80),
  recipient text not null check (length(trim(recipient)) between 1 and 80),
  body text not null check (length(trim(body)) between 1 and 8000),
  closing text not null default 'Forever yours' check (length(closing) <= 80),
  open_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists love_letters_created on public.love_letters (created_at desc);

alter table public.love_letters enable row level security;
revoke all on public.love_letters from anon, authenticated;

create or replace function public.letter_view(l public.love_letters)
returns jsonb language sql stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', l.id, 'authorEmail', l.author_email, 'authorName', l.author_name, 'recipient', l.recipient,
    'closing', l.closing, 'openAt', l.open_at, 'createdAt', l.created_at,
    'sealed', l.open_at is not null and l.open_at > now(),
    'body', case when l.open_at is not null and l.open_at > now() then null else l.body end
  );
$$;
revoke all on function public.letter_view(public.love_letters) from public, anon, authenticated;

create or replace function public.letter_list(p_token text)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  return coalesce((select jsonb_agg(public.letter_view(l) order by l.created_at desc) from public.love_letters l), '[]'::jsonb);
end;
$$;

create or replace function public.letter_send(
  p_token text, p_author_email text, p_author_name text, p_recipient text, p_body text, p_closing text, p_open_at timestamptz
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  l public.love_letters;
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  insert into public.love_letters (author_email, author_name, recipient, body, closing, open_at)
  values (lower(trim(p_author_email)), trim(p_author_name), trim(p_recipient), p_body,
          coalesce(nullif(trim(p_closing), ''), 'Forever yours'), p_open_at)
  returning * into l;
  return public.letter_view(l);
end;
$$;

-- Only the writer can take a letter back.
create or replace function public.letter_delete(p_token text, p_id uuid, p_author_email text)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  delete from public.love_letters where id = p_id and author_email = lower(trim(p_author_email));
  return found;
end;
$$;

revoke all on function public.letter_list(text) from public;
revoke all on function public.letter_send(text, text, text, text, text, text, timestamptz) from public;
revoke all on function public.letter_delete(text, uuid, text) from public;
grant execute on function public.letter_list(text) to anon, authenticated;
grant execute on function public.letter_send(text, text, text, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.letter_delete(text, uuid, text) to anon, authenticated;
