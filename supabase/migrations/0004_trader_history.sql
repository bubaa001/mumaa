-- Trade history replays: one small row per closed trade, written once by the PC/VM reporter.
create table if not exists public.trader_trades (
  position_id bigint primary key,
  closed_at timestamptz not null,
  data jsonb not null
);
alter table public.trader_trades enable row level security;
revoke all on public.trader_trades from anon, authenticated;

create or replace function public.trader_push_trade(p_token text, p_id bigint, p_trade jsonb)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.trader_token_ok('ingest', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  if octet_length(p_trade::text) > 60000 then
    raise exception 'trade too large';
  end if;
  insert into public.trader_trades (position_id, closed_at, data)
  values (p_id, coalesce((p_trade->>'closed')::timestamptz, now()), p_trade)
  on conflict (position_id) do update set data = excluded.data, closed_at = excluded.closed_at;
  delete from public.trader_trades where closed_at < now() - interval '365 days';
end;
$$;

create or replace function public.trader_pull(p_token text)
returns jsonb language plpgsql stable security definer
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
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(data order by closed_at desc)
      from (select data, closed_at from public.trader_trades order by closed_at desc limit 50) h
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.trader_push_trade(text, bigint, jsonb) from public;
grant execute on function public.trader_push_trade(text, bigint, jsonb) to anon, authenticated;
revoke all on function public.trader_pull(text) from public;
grant execute on function public.trader_pull(text) to anon, authenticated;

notify pgrst, 'reload schema';
select 'trader history ok' as result;
