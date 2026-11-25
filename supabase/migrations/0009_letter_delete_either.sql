-- Letters: either of you can delete a letter, the one who wrote it or the one it was written to.
-- Only the two signed-in members ever reach this (the mumaa server checks the session first and calls
-- with the server-only read token), so "either of you" is anyone who gets this far. The function keeps
-- its signature; p_author_email is now only recorded in the server log by the caller, not checked here.

create or replace function public.letter_delete(p_token text, p_id uuid, p_author_email text)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.trader_token_ok('read', p_token) then
    raise exception using errcode = 'insufficient_privilege', message = 'bad token';
  end if;
  delete from public.love_letters where id = p_id;
  return found;
end;
$$;

revoke all on function public.letter_delete(text, uuid, text) from public;
grant execute on function public.letter_delete(text, uuid, text) to anon, authenticated;
