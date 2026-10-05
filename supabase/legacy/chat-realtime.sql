-- =========================================================
-- BIRDSHOP CHAT REALTIME
--
-- Enables PostgreSQL realtime events for service_messages.
--
-- This allows the authenticated Admin panel to receive new
-- customer-message events immediately instead of polling
-- every 3 seconds.
-- =========================================================

do $$
begin

  if not exists (
    select 1

    from pg_publication_tables

    where pubname =
      'supabase_realtime'

      and schemaname =
        'public'

      and tablename =
        'service_messages'
  ) then

    execute
      'alter publication supabase_realtime add table public.service_messages';

  end if;

end;
$$;