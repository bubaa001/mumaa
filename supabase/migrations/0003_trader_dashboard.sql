-- Trading dashboard storage.
-- The PC-side reporter writes through trader_push(); the mumaa server reads through trader_pull().
-- Both need a secret token whose SHA-256 hash is in trader_tokens, so the publishable key alone
-- can neither read nor write any of this. Tables have RLS on and no policies (no direct access).

create table if not exists public.trader_tokens (
  kind text primary key check (kind in ('ingest', 'read')),
  token_hash text not null
);

create table if not exists public.trader_state (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.trader_equity (
  ts timestamptz primary key,
  equity double precision not null,
  balance double precision not null
);

alter table public.trader_tokens enable row level security;
alter table public.trader_state  enable row level security;
alter table public.trader_equity enable row level security;
revoke all on public.trader_tokens, public.trader_state, public.trader_equity from anon, authenticated;

create or replace function public.trader_token_ok(p_kind text, p_token text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select exists (
    select 1 from public.trader_tokens
    where kind = p_kind
      and token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
  );
$$;
revoke all on function public.trader_token_ok(text, text) from public, anon, authenticated;

create or replace function public.trader_push(p_token text, p_state jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  eq double precision := (p_state #>> '{account,equity}')::double precision;
  bal double precision := (p_state #>> '{account,balance}')::double precision;
begin
  if not public.trader_token_ok('ingest', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  if octet_length(p_state::text) > 500000 then
    raise exception 'state too large';
  end if;
  insert into public.trader_state (id, data, updated_at) values (1, p_state, now())
  on conflict (id) do update set data = excluded.data, updated_at = now();
  -- one equity point per 5 minutes, 90 days kept
  if eq is not null and not exists (
    select 1 from public.trader_equity where ts > now() - interval '5 minutes'
  ) then
    insert into public.trader_equity (ts, equity, balance) values (now(), eq, coalesce(bal, eq));
    delete from public.trader_equity where ts < now() - interval '90 days';
  end if;
end;
$$;

create or replace function public.trader_pull(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  return jsonb_build_object(
    'state', (select data from public.trader_state where id = 1),
    'updated_at', (select updated_at from public.trader_state where id = 1),
    'equity', coalesce((
      select jsonb_agg(jsonb_build_object('t', ts, 'e', equity, 'b', balance) order by ts)
      from public.trader_equity where ts > now() - interval '30 days'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.trader_push(text, jsonb) from public;
revoke all on function public.trader_pull(text) from public;
grant execute on function public.trader_push(text, jsonb) to anon, authenticated;
grant execute on function public.trader_pull(text) to anon, authenticated;
