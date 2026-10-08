-- =========================================================
-- BIRDSHOP LAUNCH DAY, STEP 2 of 2: REMOVE TEST DATA
--
-- Run ONCE, right before you switch Stripe to live keys. It permanently
-- removes every order, payment record, checkout, chat, email job and Stripe
-- event recorded while the store ran in Stripe TEST mode, so the admin starts
-- at zero for real customers.
--
-- KEPT: products, services, images, codes (see below), reviews (unless you
-- choose otherwise), staff accounts, settings and the admin audit log.
-- Your Stripe TEST-mode history stays in Stripe's test mode; it is separate
-- from live mode and is not affected.
--
-- SAFETY:
-- * Refuses to run unless you type the confirmation below.
-- * Refuses to run if ANY live-mode Stripe payment is recorded.
-- * Refuses to run if another table depends on the data being removed.
-- * Everything runs in one transaction: if any check fails, nothing changes.
--
-- HOW TO RUN
-- 1. Run 1-preview-test-data.sql first and check every listed record is a test.
-- 2. Further down, find the line that starts with  confirm text  and type
--    DELETE TEST DATA between its two quote marks.
-- 3. Optionally change the four choices under it.
-- 4. Paste the whole file into Supabase -> SQL Editor and click Run.
--    The result shows what was cleared. Then put the confirm line back to ''.
--
-- Not a migration. Do not add it to supabase/migrations.
-- =========================================================

begin;

do $$
declare
  -- Type DELETE TEST DATA between the quotes to allow this script to run.
  confirm text := '';

  -- Choices
  clear_contact_requests boolean := true;  -- Contact page messages sent while testing
  clear_analytics        boolean := true;  -- page views and visitor counts from testing
  clear_reviews          boolean := false; -- true removes ALL reviews, including real ones
  reuse_test_sold_codes  boolean := false; -- true puts codes emailed in test orders back
                                           -- on sale. Only if you are sure nobody used them.

  -- Order matters only for readability; TRUNCATE handles them together.
  core text[] := array[
    'birdshop_checkout_inventory', 'birdshop_package_checkouts',
    'birdshop_service_purchases', 'birdshop_checkout_attempts',
    'order_fulfillments', 'order_items', 'birdshop_chat_submissions',
    'birdshop_customer_device_chats', 'birdshop_customer_devices',
    'birdshop_customer_login_links', 'birdshop_customer_sessions',
    'service_messages', 'service_payment_requests', 'service_conversations',
    'orders', 'birdshop_email_jobs', 'birdshop_stripe_events',
    'birdshop_rate_limits'
  ];
  optional text[] := '{}';
  targets text[] := '{}';
  target_ids oid[];
  t text;
  blocker record;
  n bigint;
  freed bigint := 0;
  retired bigint := 0;
  restored bigint := 0;
begin
  if confirm is distinct from 'DELETE TEST DATA' then
    raise exception 'Stopped: nothing was deleted. Set the confirm line to DELETE TEST DATA to run the reset.';
  end if;

  -- 1. Never touch real money.
  select count(*) into n from public.birdshop_stripe_events
    where coalesce(payload ->> 'livemode', 'false') = 'true';
  if n > 0 then
    raise exception 'Stopped: % live-mode Stripe event(s) are recorded, so real payments exist. Nothing was deleted.', n;
  end if;

  select count(*) into n from public.birdshop_checkout_attempts
    where stripe_session_id like 'cs_live_%';
  if n > 0 then
    raise exception 'Stopped: % live-mode checkout(s) found. Nothing was deleted.', n;
  end if;

  select count(*) into n from public.service_payment_requests
    where stripe_checkout_session_id like 'cs_live_%';
  if n > 0 then
    raise exception 'Stopped: % live-mode payment request(s) found. Nothing was deleted.', n;
  end if;

  select count(*) into n from public.orders where payment_reference like 'cs_live_%';
  if n > 0 then
    raise exception 'Stopped: % live-mode order(s) found. Nothing was deleted.', n;
  end if;

  -- 2. Decide what to clear (tables that do not exist are skipped).
  if clear_contact_requests then optional := optional || 'support_requests'::text; end if;
  if clear_analytics then optional := optional || array['page_views', 'site_sessions']; end if;
  if clear_reviews then optional := optional || 'reviews'::text; end if;

  foreach t in array core || optional loop
    if to_regclass(format('public.%I', t)) is not null then
      targets := targets || t;
    end if;
  end loop;

  select array_agg(to_regclass(format('public.%I', x))::oid)
    into target_ids
    from unnest(targets) x;

  -- 3. Stop if anything outside this list depends on what is being removed.
  for blocker in
    select c.conrelid::regclass as from_table, c.confrelid::regclass as to_table
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = any (target_ids)
      and not (c.conrelid = any (target_ids))
  loop
    raise exception 'Stopped: % depends on % and is not part of this reset. Nothing was deleted.',
      blocker.from_table, blocker.to_table;
  end loop;

  -- 4. Remove the test records. TRUNCATE (without CASCADE) fails safely if a
  --    dependency was missed, rolling back everything.
  execute 'truncate table '
    || (select string_agg(format('public.%I', x), ', ') from unnest(targets) x);

  -- 5. Codes. Their test orders are gone, so their locks no longer apply.
  --    Stock counts update automatically from code status.
  update public.product_inventory
    set status = 'available', reserved_reference = null, reserved_at = null
    where status = 'reserved';
  get diagnostics freed = row_count;

  if reuse_test_sold_codes then
    update public.product_inventory
      set status = 'available', sold_at = null,
          reserved_reference = null, reserved_at = null
      where status = 'sold';
    get diagnostics restored = row_count;
  else
    update public.product_inventory
      set status = 'disabled',
          note = left(concat_ws(' · ', nullif(note, ''),
            'Emailed in a test order before launch'), 240)
      where status = 'sold';
    get diagnostics retired = row_count;
  end if;

  -- Belt and braces: recount stock for any code-managed product that drifted.
  -- (Setting stock makes the products trigger recalculate it from the codes.)
  update public.products p set stock = p.stock
    where p.inventory_mode = 'keys'
      and p.stock is distinct from (
        select count(*)::integer from public.product_inventory i
        where i.product_id = p.id and i.status = 'available');

  raise notice 'Cleared tables: %', array_to_string(targets, ', ');
  raise notice 'Reserved codes released: %', freed;
  raise notice 'Test-sold codes disabled: %', retired;
  raise notice 'Test-sold codes put back on sale: %', restored;
end $$;

commit;

-- What is left. Orders, chats and checkouts should all be 0.
select 'orders' as area, count(*)::text as now from public.orders
union all select 'service chats', count(*)::text from public.service_conversations
union all select 'checkout attempts', count(*)::text from public.birdshop_checkout_attempts
union all select 'queued emails', count(*)::text from public.birdshop_email_jobs
union all select 'codes available', count(*)::text from public.product_inventory where status = 'available'
union all select 'codes disabled', count(*)::text from public.product_inventory where status = 'disabled'
union all select 'codes reserved or sold (should be 0)', count(*)::text from public.product_inventory where status in ('reserved', 'sold');
