-- Public track record (/performance): long-term equity and every closed trade since tracking began.
--
-- trader_equity keeps 5-minute points for 90 days only, so a daily close is kept forever in
-- trader_daily (filled by a trigger on every equity insert). trader_public_record() returns what
-- the public page needs; the mumaa server turns it into percentages (no money amounts are shown).
-- Read with the 'read' token, like trader_pull().

create table if not exists public.trader_daily (
  day date primary key,
  equity double precision not null,
  balance double precision not null,
  at timestamptz not null
);
alter table public.trader_daily enable row level security;
revoke all on public.trader_daily from anon, authenticated;

create or replace function public.trader_daily_keep()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.trader_daily (day, equity, balance, at)
  values ((new.ts at time zone 'utc')::date, new.equity, new.balance, new.ts)
  on conflict (day) do update set equity = excluded.equity, balance = excluded.balance, at = excluded.at
  where public.trader_daily.at <= excluded.at;
  return new;
end;
$$;
revoke all on function public.trader_daily_keep() from public, anon, authenticated;

drop trigger if exists trader_daily_keep on public.trader_equity;
create trigger trader_daily_keep after insert on public.trader_equity
for each row execute function public.trader_daily_keep();

-- backfill from the 5-minute points still kept
insert into public.trader_daily (day, equity, balance, at)
select distinct on ((ts at time zone 'utc')::date) (ts at time zone 'utc')::date, equity, balance, ts
from public.trader_equity order by (ts at time zone 'utc')::date, ts desc
on conflict (day) do nothing;

create or replace function public.trader_public_record(p_token text)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  seed_at timestamptz := (select at from public.investor_flows where kind = 'seed' limit 1);
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  return jsonb_build_object(
    'start', seed_at,
    'updated_at', (select updated_at from public.trader_state where id = 1),
    'currency', (select data #>> '{account,currency}' from public.trader_state where id = 1),
    'equity', (select (data #>> '{account,equity}')::double precision from public.trader_state where id = 1),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('t', at, 'e', equity) order by day)
      from public.trader_daily), '[]'::jsonb),
    -- last 30 days at hourly resolution (last point of each hour)
    'recent', coalesce((select jsonb_agg(jsonb_build_object('t', ts, 'e', equity) order by ts)
      from (select distinct on (date_trunc('hour', ts)) ts, equity from public.trader_equity
            where ts > now() - interval '30 days' order by date_trunc('hour', ts), ts desc) h), '[]'::jsonb),
    'flows', coalesce((select jsonb_agg(jsonb_build_object('t', at, 'amount', amount) order by at)
      -- every deposit/withdrawal (bonuses too): none of them is trading profit
      from public.investor_flows where kind <> 'seed'), '[]'::jsonb),
    'trades', coalesce((select jsonb_agg(jsonb_build_object(
        'bot', data->>'bot', 'symbol', data->>'symbol', 'side', data->>'side',
        'profit', (data->>'profit')::double precision, 'r', (data->>'r')::double precision,
        'opened', data->>'opened', 'closed', closed_at) order by closed_at desc)
      from (select data, closed_at from public.trader_trades
            where seed_at is null or closed_at >= seed_at order by closed_at desc limit 2000) t), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.trader_public_record(text) from public;
grant execute on function public.trader_public_record(text) to anon, authenticated;

notify pgrst, 'reload schema';
select 'public record ok' as result;
