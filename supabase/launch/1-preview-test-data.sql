-- =========================================================
-- BIRDSHOP LAUNCH DAY, STEP 1 of 2: PREVIEW (read-only)
--
-- Shows what 2-reset-test-data.sql would remove. This file changes nothing.
-- Run it in Supabase -> SQL Editor. It returns ONE table, in this order:
--   1 LIVE CHECK      every number must be 0 (otherwise the reset refuses to run)
--   2 ROW COUNT       how many rows each area has now
--   3 CODES           codes by status ("reserved" go back on sale; "sold" were
--                     emailed in test orders and become "disabled" by default)
--   4 ORDER / 5 CHAT / 6 CONTACT REQUEST
--                     every record that would be removed. Check the emails:
--                     they should all be you or your testers.
--
-- Not a migration. Do not add it to supabase/migrations.
-- =========================================================

select step, section, item, detail
from (
  -- 1. Live-payment check
  select 1 as step, 'LIVE CHECK (must be 0)' as section, 'live Stripe events' as item,
    (select count(*) from public.birdshop_stripe_events
      where coalesce(payload ->> 'livemode', 'false') = 'true')::text as detail
  union all
  select 1, 'LIVE CHECK (must be 0)', 'live checkouts',
    (select count(*) from public.birdshop_checkout_attempts
      where stripe_session_id like 'cs_live_%')::text
  union all
  select 1, 'LIVE CHECK (must be 0)', 'live payment requests',
    (select count(*) from public.service_payment_requests
      where stripe_checkout_session_id like 'cs_live_%')::text
  union all
  select 1, 'LIVE CHECK (must be 0)', 'live orders',
    (select count(*) from public.orders where payment_reference like 'cs_live_%')::text

  -- 2. Row counts
  union all select 2, 'ROW COUNT', 'orders', (select count(*) from public.orders)::text
  union all select 2, 'ROW COUNT', 'service chats', (select count(*) from public.service_conversations)::text
  union all select 2, 'ROW COUNT', 'chat messages', (select count(*) from public.service_messages)::text
  union all select 2, 'ROW COUNT', 'payment requests', (select count(*) from public.service_payment_requests)::text
  union all select 2, 'ROW COUNT', 'checkout attempts', (select count(*) from public.birdshop_checkout_attempts)::text
  union all select 2, 'ROW COUNT', 'emails (queued or sent)', (select count(*) from public.birdshop_email_jobs)::text
  union all select 2, 'ROW COUNT', 'Stripe events', (select count(*) from public.birdshop_stripe_events)::text
  union all select 2, 'ROW COUNT', 'contact requests', (select count(*) from public.support_requests)::text
  union all select 2, 'ROW COUNT', 'page views', (select count(*) from public.page_views)::text
  union all select 2, 'ROW COUNT', 'visitor sessions', (select count(*) from public.site_sessions)::text
  union all select 2, 'ROW COUNT', 'reviews (kept unless you choose otherwise)', (select count(*) from public.reviews)::text

  -- 3. Codes by status
  union all
  select 3, 'CODES', status, count(*)::text
  from public.product_inventory
  group by status

  -- 4. Orders
  union all
  select 4, 'ORDER', reference,
    concat_ws(' · ', customer_email, total::text, payment_status, source,
      to_char(created_at, 'YYYY-MM-DD HH24:MI'))
  from public.orders

  -- 5. Chats
  union all
  select 5, 'CHAT', coalesce(conversation_type, 'chat'),
    concat_ws(' · ', customer_email, status, workflow_status,
      to_char(created_at, 'YYYY-MM-DD HH24:MI'))
  from public.service_conversations

  -- 6. Contact requests
  union all
  select 6, 'CONTACT REQUEST', reference,
    concat_ws(' · ', topic, display_name, contact_handle,
      to_char(created_at, 'YYYY-MM-DD HH24:MI'))
  from public.support_requests
) preview
order by step, section, item, detail;
