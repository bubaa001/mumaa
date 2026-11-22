-- Investor management: rename / remove investors, undo an assignment, split one MT5 deposit
-- between several people. Run after 0005. Same rules as before: read token, founder checked
-- by the mumaa server first.

-- A split deposit: the flow gets status 'split' and its money is listed here, per investor.
create table if not exists public.investor_flow_parts (
  flow_id bigint not null references public.investor_flows(id) on delete cascade,
  investor_id bigint not null references public.investors(id),
  amount double precision not null check (amount <> 0),
  primary key (flow_id, investor_id)
);
alter table public.investor_flow_parts enable row level security;
revoke all on public.investor_flow_parts from anon, authenticated;

alter table public.investor_flows drop constraint if exists investor_flows_status_check;
alter table public.investor_flows add constraint investor_flows_status_check
  check (status in ('unassigned', 'assigned', 'ignored', 'split'));

-- the pull now carries the split parts too
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
    'parts', coalesce((select jsonb_agg(to_jsonb(p) order by p.flow_id, p.investor_id) from public.investor_flow_parts p), '[]'::jsonb),
    'marks', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from public.investor_marks m), '[]'::jsonb),
    'equity', (select (data #>> '{account,equity}')::double precision from public.trader_state where id = 1),
    'currency', (select data #>> '{account,currency}' from public.trader_state where id = 1),
    'updated_at', (select updated_at from public.trader_state where id = 1)
  );
end;
$$;

create or replace function public.investor_rename(p_token text, p_id bigint, p_name text)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  if exists (select 1 from public.investors where lower(name) = lower(trim(p_name)) and id <> p_id) then
    raise exception 'someone already has that name';
  end if;
  update public.investors set name = trim(p_name) where id = p_id;
  if not found then raise exception 'no such investor'; end if;
end;
$$;

-- Only someone with no money in the books can be removed (never the founder).
create or replace function public.investor_remove(p_token text, p_id bigint)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  if exists (select 1 from public.investors where id = p_id and is_founder) then
    raise exception 'the founder cannot be removed';
  end if;
  if exists (select 1 from public.investor_flows where investor_id = p_id)
     or exists (select 1 from public.investor_flow_parts where investor_id = p_id) then
    raise exception 'this investor has money in the books: undo their deposits first';
  end if;
  delete from public.investors where id = p_id;
  if not found then raise exception 'no such investor'; end if;
end;
$$;

-- Undo: a deposit/withdrawal goes back to "whose money?" (also clears a split).
create or replace function public.investor_unassign(p_token text, p_flow bigint)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare fl public.investor_flows;
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  select * into fl from public.investor_flows where id = p_flow for update;
  if fl.id is null or fl.kind = 'seed' then raise exception 'no such deposit'; end if;
  if fl.status = 'unassigned' then return; end if;
  delete from public.investor_flow_parts where flow_id = p_flow;
  update public.investor_flows set status = 'unassigned', investor_id = null where id = p_flow;
end;
$$;

-- Split one deposit/withdrawal: p_parts = [{"investor": id, "amount": n}, ...], same sign as the
-- flow, adding up to its amount (to the cent). Oldest first, like a normal assignment.
create or replace function public.investor_split(p_token text, p_flow bigint, p_parts jsonb)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  fl public.investor_flows;
  p jsonb;
  total double precision := 0;
  n integer := 0;
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  select * into fl from public.investor_flows where id = p_flow for update;
  if fl.id is null or fl.kind = 'seed' then raise exception 'no such deposit'; end if;
  if fl.status <> 'unassigned' then raise exception 'already assigned: undo it first'; end if;
  if exists (select 1 from public.investor_flows o where o.status = 'unassigned' and (o.at, o.id) < (fl.at, fl.id)) then
    raise exception 'assign the older deposits first';
  end if;
  if jsonb_typeof(p_parts) <> 'array' or jsonb_array_length(p_parts) < 2 or jsonb_array_length(p_parts) > 20 then
    raise exception 'a split needs 2 to 20 people';
  end if;
  for p in select * from jsonb_array_elements(p_parts) loop
    if not exists (select 1 from public.investors where id = (p->>'investor')::bigint) then
      raise exception 'no such investor';
    end if;
    if (p->>'amount')::double precision is null or (p->>'amount')::double precision * fl.amount <= 0 then
      raise exception 'each amount must be above zero';
    end if;
    total := total + (p->>'amount')::double precision;
    n := n + 1;
  end loop;
  if abs(total - fl.amount) > 0.005 then
    raise exception 'the parts add up to %, not %', round(total::numeric, 2), round(fl.amount::numeric, 2);
  end if;
  insert into public.investor_flow_parts (flow_id, investor_id, amount)
  select p_flow, (x->>'investor')::bigint, (x->>'amount')::double precision from jsonb_array_elements(p_parts) x;
  update public.investor_flows set status = 'split', investor_id = null where id = p_flow;
end;
$$;

revoke all on function public.investor_rename(text, bigint, text) from public;
revoke all on function public.investor_remove(text, bigint) from public;
revoke all on function public.investor_unassign(text, bigint) from public;
revoke all on function public.investor_split(text, bigint, jsonb) from public;
grant execute on function public.investor_rename(text, bigint, text) to anon, authenticated;
grant execute on function public.investor_remove(text, bigint) to anon, authenticated;
grant execute on function public.investor_unassign(text, bigint) to anon, authenticated;
grant execute on function public.investor_split(text, bigint, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
select 'investor management ok' as result;
