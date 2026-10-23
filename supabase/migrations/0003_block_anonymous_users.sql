-- Applied via the Supabase MCP (migration "block_anonymous_users").
-- Anonymous sign-ins also get the `authenticated` role, so exclude them
-- explicitly. Public email sign-ups must still be disabled in Auth settings.
drop policy "authenticated full access" on public.events;
drop policy "authenticated full access" on public.tickets;
create policy "signed-in (non-anonymous) full access" on public.events
  for all to authenticated
  using ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) = false)
  with check ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) = false);
create policy "signed-in (non-anonymous) full access" on public.tickets
  for all to authenticated
  using ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) = false)
  with check ((select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)) = false);
