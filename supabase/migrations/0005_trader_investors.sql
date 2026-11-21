-- Investor tracking for the trading account (one MT5 account, several people's money in it).
--
-- How money is split: the account is divided into units. Tracking starts with a "seed" flow: the
-- founder owns the whole account at 1 unit = 1 account-currency unit. Every later deposit buys units
-- at the price just before the money arrived (account equity / units), every withdrawal sells units,
-- so deposits are never counted as trading profit. The ledger maths (units, founder fee with a
-- high-water mark) runs in the site from these raw rows: src/lib/investors.ts.
--
-- Writers:
--   trader_sync_flows()  the VM reporter (ingest token): MT5 deposits/withdrawals + a month-start
--                        equity mark used to settle the monthly founder fee.
--   investor_*()         the mumaa server (read token), only after it has checked the signed-in
--                        user is the founder. Tables have RLS on and no policies (no direct access).

create table if not exists public.investors (
  id bigserial primary key,
  name text not null unique check (length(trim(name)) between 1 and 60),
  is_founder boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.investor_flows (
  id bigserial primary key,
  deal_id bigint unique,                 -- MT5 balance deal ticket (null for the seed)
  at timestamptz not null,
  amount double precision not null,      -- + deposit, - withdrawal (account currency)
  nav_before double precision,           -- account equity just before the money moved
  kind text not null check (kind in ('seed', 'deposit', 'withdrawal')),
  status text not null default 'unassigned' check (status in ('unassigned', 'assigned', 'ignored')),
  investor_id bigint references public.investors(id),
  comment text,
  created_at timestamptz not null default now(),
  check (status <> 'assigned' or investor_id is not null)
);
create index if not exists investor_flows_at on public.investor_flows (at);

-- Equity at the first report of each month (UTC): the price the previous month's fee is settled at.
create table if not exists public.investor_marks (
  month date primary key,
  equity double precision not null,
  at timestamptz not null default now()
);

alter table public.investors      enable row level security;
alter table public.investor_flows enable row level security;
alter table public.investor_marks enable row level security;
revoke all on public.investors, public.investor_flows, public.investor_marks from anon, authenticated;

-- ---------------------------------------------------------------- reporter (VM)
-- p_flows: [{"id": deal ticket, "at": iso time, "amount": +/-, "nav_before": number|null, "comment": text}]
create or replace function public.trader_sync_flows(p_token text, p_equity double precision, p_flows jsonb)
returns integer language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  f jsonb;
  added integer := 0;
  seed_at timestamptz := (select at from public.investor_flows where kind = 'seed' limit 1);
  f_at timestamptz;
  f_amt double precision;
  nav double precision;
begin
  if not public.trader_token_ok('ingest', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  if jsonb_typeof(p_flows) <> 'array' or jsonb_array_length(p_flows) > 500 then
    raise exception 'bad flows';
  end if;
  for f in select * from jsonb_array_elements(p_flows) loop
    f_at := (f->>'at')::timestamptz;
    f_amt := (f->>'amount')::double precision;
    if f_amt is null or f_amt = 0 or f_at is null then continue; end if;
    if exists (select 1 from public.investor_flows where deal_id = (f->>'id')::bigint) then continue; end if;
    nav := (f->>'nav_before')::double precision;
    if nav is null then  -- late detection: last equity sample before the deal (5-minute resolution)
      select equity into nav from public.trader_equity where ts <= f_at order by ts desc limit 1;
    end if;
    insert into public.investor_flows (deal_id, at, amount, nav_before, kind, status, comment)
    values ((f->>'id')::bigint, f_at, f_amt, nav,
            case when f_amt > 0 then 'deposit' else 'withdrawal' end,
            -- money that moved before tracking started is history, not investor money
            case when seed_at is null or f_at <= seed_at then 'ignored' else 'unassigned' end,
            left(f->>'comment', 120));
    added := added + 1;
  end loop;
  if p_equity is not null and seed_at is not null then
    insert into public.investor_marks (month, equity)
    values (date_trunc('month', now() at time zone 'utc')::date, p_equity)
    on conflict (month) do nothing;
  end if;
  return added;
end;
$$;

-- ---------------------------------------------------------------- site (founder only)
create or replace function public.investor_pull(p_token text)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  return jsonb_build_object(
    'investors', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.investors i), '[]'::jsonb),
    'flows', coalesce((select jsonb_agg(to_jsonb(f) order by f.at, f.id) from public.investor_flows f), '[]'::jsonb),
    'marks', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from public.investor_marks m), '[]'::jsonb),
    'equity', (select (data #>> '{account,equity}')::double precision from public.trader_state where id = 1),
    'currency', (select data #>> '{account,currency}' from public.trader_state where id = 1),
    'updated_at', (select updated_at from public.trader_state where id = 1)
  );
end;
$$;

-- Start tracking: the whole account (latest equity) becomes the founder's stake.
create or replace function public.investor_start(p_token text, p_founder text)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  eq double precision := (select (data #>> '{account,equity}')::double precision from public.trader_state where id = 1);
  fid bigint;
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  if exists (select 1 from public.investor_flows where kind = 'seed') then
    raise exception 'tracking already started';
  end if;
  if eq is null or eq <= 0 then
    raise exception 'no account equity reported yet';
  end if;
  insert into public.investors (name, is_founder) values (trim(p_founder), true) returning id into fid;
  insert into public.investor_flows (at, amount, nav_before, kind, status, investor_id, comment)
  values (now(), eq, 0, 'seed', 'assigned', fid, 'founder stake at start');
  insert into public.investor_marks (month, equity)
  values (date_trunc('month', now() at time zone 'utc')::date, eq) on conflict (month) do nothing;
end;
$$;

create or replace function public.investor_add(p_token text, p_name text)
returns bigint language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare nid bigint;
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  insert into public.investors (name) values (trim(p_name)) returning id into nid;
  return nid;
end;
$$;

-- Say whose money a deposit/withdrawal was (p_investor), or mark it 'ignored' (not investor money:
-- e.g. a broker bonus, which then counts as profit for everyone). Oldest first, so unit prices stay right.
create or replace function public.investor_assign(p_token text, p_flow bigint, p_investor bigint, p_ignore boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  fl public.investor_flows;
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  select * into fl from public.investor_flows where id = p_flow for update;
  if fl.id is null or fl.kind = 'seed' then raise exception 'no such deposit'; end if;
  if fl.status <> 'unassigned' then raise exception 'already assigned'; end if;
  if exists (select 1 from public.investor_flows o where o.status = 'unassigned' and (o.at, o.id) < (fl.at, fl.id)) then
    raise exception 'assign the older deposits first';
  end if;
  if coalesce(p_ignore, false) then
    update public.investor_flows set status = 'ignored' where id = p_flow;
  else
    if not exists (select 1 from public.investors where id = p_investor) then raise exception 'no such investor'; end if;
    update public.investor_flows set status = 'assigned', investor_id = p_investor where id = p_flow;
  end if;
end;
$$;

revoke all on function public.trader_sync_flows(text, double precision, jsonb) from public;
revoke all on function public.investor_pull(text) from public;
revoke all on function public.investor_start(text, text) from public;
revoke all on function public.investor_add(text, text) from public;
revoke all on function public.investor_assign(text, bigint, bigint, boolean) from public;
grant execute on function public.trader_sync_flows(text, double precision, jsonb) to anon, authenticated;
grant execute on function public.investor_pull(text) to anon, authenticated;
grant execute on function public.investor_start(text, text) to anon, authenticated;
grant execute on function public.investor_add(text, text) to anon, authenticated;
grant execute on function public.investor_assign(text, bigint, bigint, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
select 'investor tracking ok' as result;
