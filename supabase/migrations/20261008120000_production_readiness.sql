-- BirdShop production-readiness hardening. Additive and idempotent: no customer,
-- order, payment or inventory rows are deleted or rewritten. Apply after
-- 20261008090000_custom_only_services.sql. Verify with supabase/verify-production-readiness.sql.
begin;

-- =========================================================
-- 1. STAFF HELPER: deactivated staff lose legacy admin access
--    (legacy definition accepted any admin_users row).
-- =========================================================
create or replace function public.is_birdshop_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active
      and role in ('owner', 'service_agent')
  );
$$;
revoke all on function public.is_birdshop_admin() from public, anon;
grant execute on function public.is_birdshop_admin() to authenticated, service_role;

-- =========================================================
-- 2. SERVICE ORDER STATUS: owner-only, explicit transitions,
--    one completion email per order, chat status kept in sync.
-- =========================================================
create or replace function public.birdshop_set_service_order_status(
  p_order_id uuid, p_status text, p_assigned_to text default null
) returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_assigned text := nullif(trim(coalesce(p_assigned_to, '')), '');
  v_chat record;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_birdshop_owner() then
    raise exception 'Active owner required.';
  end if;
  if p_status is null or p_status not in (
    'new','discussing','quote_sent','awaiting_payment','assigned','in_progress',
    'waiting_customer','customer_replied','ready_for_delivery','completed','cancelled'
  ) then raise exception 'Invalid service status.'; end if;
  if v_assigned is not null and length(v_assigned) > 120 then
    raise exception 'Assignee name is too long.';
  end if;

  -- Lock order matches the payment/refund functions: conversation first, then order.
  perform 1 from public.service_conversations where order_id = p_order_id order by id for update;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.order_type <> 'service' then raise exception 'This is not a service order.'; end if;

  -- No-op repeats (double clicks, refreshes) change nothing and send nothing.
  if p_status = v_order.service_status and v_assigned is not distinct from null then return; end if;
  -- Completion is terminal: the customer has been told the work is done.
  if v_order.service_status = 'completed' then
    raise exception 'Completed orders cannot be reopened.';
  end if;
  -- A fully refunded order is closed by the refund; work cannot restart on it.
  if v_order.payment_status = 'refunded' or v_order.order_status = 'refunded' then
    raise exception 'Refunded orders cannot change status.';
  end if;
  if p_status = 'assigned' and coalesce(v_assigned, v_order.assigned_to) is null then
    raise exception 'Assign an admin before using Assigned status.';
  end if;
  if p_status in ('ready_for_delivery', 'completed')
     and v_order.source is distinct from 'admin_test'
     and coalesce(v_order.payment_status, '') not in ('paid', 'partially_refunded') then
    raise exception 'Payment must be recorded before final delivery or completion.';
  end if;

  update public.orders set
    service_status = p_status,
    assigned_to = coalesce(v_assigned, assigned_to),
    order_status = case
      when p_status = 'completed' then 'completed'
      when p_status = 'cancelled' then 'cancelled'
      when payment_status in ('paid', 'partially_refunded') then 'active'
      else 'pending' end,
    fulfillment_status = case
      when p_status = 'completed' then 'fulfilled'
      when p_status = 'cancelled' then 'cancelled'
      else 'unfulfilled' end,
    fulfilled_at = case when p_status = 'completed' then coalesce(fulfilled_at, now()) else null end,
    cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else null end
  where id = p_order_id;

  -- Keep the customer/admin chat views consistent with the order, including
  -- when a cancelled order is put back into work.
  if p_status in ('completed', 'cancelled') then
    update public.service_conversations set workflow_status = p_status
    where order_id = p_order_id and workflow_status is distinct from p_status;
  else
    update public.service_conversations set workflow_status =
      case when v_order.payment_status in ('paid', 'partially_refunded') then 'in_progress' else 'discussing' end
    where order_id = p_order_id and workflow_status in ('cancelled', 'completed');
  end if;

  if p_status = 'completed' and v_order.source is distinct from 'admin_test' then
    for v_chat in
      select c.id, c.last_sender_type from public.service_conversations c
      where c.order_id = p_order_id and c.deleted_at is null and c.purged_at is null
    loop
      insert into public.service_messages(conversation_id, sender_type, sender_label, body, message_type, metadata)
      values (v_chat.id, 'system', 'BirdShop',
        'Your order has been completed. Thank you for choosing BirdShop. Reply here if you have any questions.',
        'system', jsonb_build_object('event', 'order_completed'));
      -- A customer message still waiting for staff keeps its unread badge.
      if v_chat.last_sender_type = 'customer' then
        update public.service_conversations set last_sender_type = 'customer' where id = v_chat.id;
      end if;
    end loop;

    -- Dedupe key makes repeated clicks, refreshes and retries harmless.
    insert into public.birdshop_email_jobs(dedupe_key, kind, entity_id)
    values ('completed/customer/' || p_order_id, 'service_completed', p_order_id)
    on conflict (dedupe_key) do nothing;
  end if;
end $$;
revoke all on function public.birdshop_set_service_order_status(uuid, text, text) from public, anon;
grant execute on function public.birdshop_set_service_order_status(uuid, text, text) to authenticated, service_role;

-- =========================================================
-- 3. OTHER OWNER-ONLY LEGACY FUNCTIONS (were any-staff via is_birdshop_admin).
-- =========================================================
create or replace function public.birdshop_permanently_delete_support_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_birdshop_owner() then
    raise exception 'Active owner required.';
  end if;
  if not exists (select 1 from public.support_requests where id = p_request_id) then
    raise exception 'Support request not found.';
  end if;
  delete from public.support_requests where id = p_request_id;
end $$;
revoke all on function public.birdshop_permanently_delete_support_request(uuid) from public, anon;
grant execute on function public.birdshop_permanently_delete_support_request(uuid) to authenticated, service_role;

create or replace function public.birdshop_admin_create_test_service_order(
  p_customer_name text, p_customer_email text, p_service_name text,
  p_package_name text, p_price numeric, p_note text default null
) returns uuid language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_order_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_birdshop_owner() then
    raise exception 'Active owner required.';
  end if;
  if trim(coalesce(p_customer_name, '')) = '' then raise exception 'Customer name is required.'; end if;
  if trim(coalesce(p_customer_email, '')) = '' then raise exception 'Customer email is required.'; end if;
  if trim(coalesce(p_service_name, '')) = '' then raise exception 'Service name is required.'; end if;
  if p_price is null or p_price < 0 or p_price > 999999.99 then raise exception 'Enter a valid price.'; end if;
  insert into public.orders (reference, customer_name, customer_email, order_type, service_name,
    package_name, package_price, service_status, order_status, payment_status,
    fulfillment_status, subtotal, total, source, notes)
  values ('', trim(p_customer_name), lower(trim(p_customer_email)), 'service', trim(p_service_name),
    nullif(trim(coalesce(p_package_name, '')), ''), p_price, 'new', 'pending', 'pending',
    'unfulfilled', p_price, p_price, 'admin_test', nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_order_id;
  return v_order_id;
end $$;
revoke all on function public.birdshop_admin_create_test_service_order(text, text, text, text, numeric, text) from public, anon;
grant execute on function public.birdshop_admin_create_test_service_order(text, text, text, text, numeric, text) to authenticated, service_role;

-- Not called by the application; remove browser access to every overload.
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'birdshop_admin_create_test_order' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- =========================================================
-- 4. PRODUCTS: storefront reads visible rows; only the owner writes.
--    Pricing for checkout is read from this table, so browser write
--    access must never depend on live dashboard settings.
-- =========================================================
alter table public.products enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.products from public, anon;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
do $$ declare pol record; begin
  -- Replace any pre-existing write policy (unknown definitions) with the owner-only one.
  for pol in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'products'
               and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
               and policyname <> 'birdshop_products_owner_manage' loop
    execute format('drop policy %I on public.products', pol.policyname);
  end loop;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products'
                 and policyname = 'birdshop_products_public_read') then
    create policy birdshop_products_public_read on public.products
      for select to anon, authenticated using (is_visible);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products'
                 and policyname = 'birdshop_products_owner_manage') then
    create policy birdshop_products_owner_manage on public.products
      for all to authenticated
      using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
  end if;
end $$;

-- Product artwork: only the owner uploads/replaces/removes (was any staff).
drop policy if exists "BirdShop admins can upload product images" on storage.objects;
create policy "BirdShop admins can upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_birdshop_owner());
drop policy if exists "BirdShop admins can update product images" on storage.objects;
create policy "BirdShop admins can update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_birdshop_owner())
  with check (bucket_id = 'product-images' and public.is_birdshop_owner());
drop policy if exists "BirdShop admins can delete product images" on storage.objects;
create policy "BirdShop admins can delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_birdshop_owner());

-- =========================================================
-- 5. INVENTORY: the owner's server action disables/re-enables codes
--    with the service role (20261007223000 granted only select/insert).
-- =========================================================
grant update (status) on public.product_inventory to service_role;

-- =========================================================
-- 6. ONE-TIME IDENTITY BACKSTOPS. Created only when existing data is
--    already clean; otherwise a NOTICE asks for manual reconciliation.
-- =========================================================
do $$ begin
  if not exists (select 1 from public.order_fulfillments group by product_inventory_id having count(*) > 1) then
    create unique index if not exists order_fulfillments_code_once
      on public.order_fulfillments(product_inventory_id);
  else raise notice 'order_fulfillments has a code assigned twice; reconcile before adding the unique index.';
  end if;
  if not exists (select 1 from public.orders where payment_provider = 'stripe' and payment_reference is not null
                 group by payment_reference having count(*) > 1) then
    create unique index if not exists orders_stripe_intent_once
      on public.orders(payment_reference) where payment_provider = 'stripe' and payment_reference is not null;
  else raise notice 'orders has duplicate Stripe PaymentIntents; reconcile before adding the unique index.';
  end if;
  if not exists (select 1 from public.service_payment_requests where stripe_payment_intent_id is not null
                 group by stripe_payment_intent_id having count(*) > 1) then
    create unique index if not exists service_payment_requests_intent_once
      on public.service_payment_requests(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
  else raise notice 'service_payment_requests has duplicate PaymentIntents; reconcile before adding the unique index.';
  end if;
end $$;

-- =========================================================
-- 7. REALTIME: admin queue subscribes to these tables. RLS still
--    applies to every subscriber; anon has no SELECT on them.
-- =========================================================
do $$ declare t text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['service_messages','service_conversations','service_payment_requests','orders'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- =========================================================
-- 8. OVERVIEW WORK QUEUES (owner only). Separate from the historical
--    birdshop_admin_report so Overview stays operational, not analytical.
-- =========================================================
create or replace function public.birdshop_admin_operations()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_today timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
  -- Each count matches what its linked admin view actually lists.
  return jsonb_build_object(
    'updated_at', now(),
    'unclaimed_chats', (select count(*) from public.service_conversations c
      where c.status = 'open' and c.deleted_at is null and c.conversation_type = 'service'
        and c.assigned_staff_user_id is null and c.source is distinct from 'admin_test'
        and coalesce(c.workflow_status, 'new') not in ('completed', 'cancelled')
        and not exists (select 1 from public.orders o where o.id = c.order_id
          and o.service_status in ('completed', 'cancelled'))),
    'unpaid_requests', (select count(*) from public.service_payment_requests p
      join public.service_conversations c on c.id = p.conversation_id
      where p.status in ('pending', 'processing') and c.status = 'open'
        and c.deleted_at is null and c.source is distinct from 'admin_test'),
    'stale_unpaid_requests', (select count(*) from public.service_payment_requests p
      join public.service_conversations c on c.id = p.conversation_id
      where p.status = 'pending' and p.created_at < now() - interval '3 days'
        and c.status = 'open' and c.deleted_at is null and c.source is distinct from 'admin_test'),
    'pending_reviews', (select count(*) from public.reviews where status = 'pending'),
    'open_support_requests', (select count(*) from public.support_requests
      where status in ('open', 'in_progress') and deleted_at is null),
    'services_ready', (select count(*) from public.orders
      where order_type = 'service' and service_status = 'ready_for_delivery'
        and source is distinct from 'admin_test' and deleted_at is null and archived_at is null),
    'services_waiting_customer', (select count(*) from public.orders
      where order_type = 'service' and service_status = 'waiting_customer'
        and source is distinct from 'admin_test' and deleted_at is null and archived_at is null),
    'today', coalesce((select jsonb_agg(x order by currency) from (
      select currency, count(*) orders, sum(total - refunded_amount) net
      from private.birdshop_reporting_orders where paid_at >= v_today group by currency) x), '[]'::jsonb),
    'today_visitors', (select count(distinct session_id) from public.page_views where created_at >= v_today)
  );
end $$;
revoke all on function public.birdshop_admin_operations() from public, anon;
grant execute on function public.birdshop_admin_operations() to authenticated;

-- =========================================================
-- 9. STALE CHECKOUTS: an attempt whose saved Stripe request can no longer
--    succeed (its expires_at has passed) and that never got a session is
--    released, so codes and service quotes are not held forever. The server
--    calls this only after a full Stripe lookup found no session for it.
-- =========================================================
create or replace function public.birdshop_v2_release_stale_checkout(p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a public.birdshop_checkout_attempts%rowtype; c_id uuid;
begin
  perform private.birdshop_require_server();
  select p.conversation_id into c_id from public.birdshop_checkout_attempts x
    join public.service_payment_requests p on p.id = x.payment_request_id where x.id = p_attempt_id;
  if c_id is not null then
    perform 1 from public.service_conversations where id = c_id for update;
    perform 1 from public.service_payment_requests
      where id = (select payment_request_id from public.birdshop_checkout_attempts where id = p_attempt_id) for update;
  end if;
  select * into a from public.birdshop_checkout_attempts where id = p_attempt_id for update;
  if not found or a.status not in ('creating', 'attention') or a.stripe_params is null
     or a.stripe_session_id is not null or a.order_id is not null
     or coalesce((a.stripe_params->>'expires_at')::bigint, 0) >= extract(epoch from now())::bigint
  then return false; end if;
  perform 1 from public.products where id in (select product_id from public.birdshop_checkout_inventory where attempt_id = a.id) order by id for update;
  update public.product_inventory set status = 'available', reserved_reference = null, reserved_at = null
    where id in (select inventory_id from public.birdshop_checkout_inventory where attempt_id = a.id)
      and status = 'reserved' and reserved_reference = 'checkout:' || a.id;
  delete from public.birdshop_checkout_inventory where attempt_id = a.id;
  update public.birdshop_checkout_attempts set status = 'failed',
    failure_reason = 'Stripe session was never created before the checkout expired.'
  where id = a.id;
  return true;
end $$;
revoke all on function public.birdshop_v2_release_stale_checkout(uuid) from public, anon, authenticated;
grant execute on function public.birdshop_v2_release_stale_checkout(uuid) to service_role;

-- =========================================================
-- 10. CUSTOMER CHAT READ: unchanged from 20261005030000 except that each payment
--     request now carries refund_status / refunded_amount, so refunded payments
--     are labelled Refunded instead of Paid.
-- =========================================================
CREATE OR REPLACE FUNCTION public.birdshop_v3_read_chat(p_token text, p_before uuid default null, p_mark_read boolean default true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token text;

  v_conversation_id uuid;

  v_result jsonb;
begin
  perform private.birdshop_require_server();

  -- =======================================================
  -- TOKEN
  -- =======================================================

  v_token :=
    trim(
      coalesce(
        p_token,
        ''
      )
    );


  if
    char_length(v_token) < 20
  then

    raise exception
      'Conversation not found.';

  end if;


  -- =======================================================
  -- VERIFY CONVERSATION
  --
  -- IMPORTANT:
  -- No order JOIN here.
  -- =======================================================

  select
    c.id

  into
    v_conversation_id

  from public.service_conversations c

  where
    c.public_token =
      v_token

    and c.deleted_at
      is null

  limit 1;


  if
    v_conversation_id is null
  then

    raise exception
      'Conversation not found.';

  end if;


  -- =======================================================
  -- CUSTOMER READ STATE
  -- =======================================================

  -- Only write when something new has arrived since the last read. An
  -- unconditional write on every poll would emit a realtime update for each
  -- customer every few seconds and keep refreshing the owner's chat queue.
  if p_mark_read and p_before is null then
  update public.service_conversations

  set
    customer_last_read_at =
      now()

  where
    id =
      v_conversation_id
    and (
      customer_last_read_at is null
      or customer_last_read_at < last_message_at
    );
  end if;


  -- =======================================================
  -- CHAT PAYLOAD
  --
  -- LEFT JOIN ORDERS because a conversation may not have
  -- an order until after payment.
  -- =======================================================

  select

    jsonb_build_object(

      -- ---------------------------------------------------
      -- CONVERSATION
      -- ---------------------------------------------------

      'conversation_id',
        c.id,

      'reference',
        c.reference,

      'conversation_type',
        c.conversation_type,

      'workflow_status',
        c.workflow_status,

      'conversation_status',
        c.status,

      'subject',
        c.subject,


      -- ---------------------------------------------------
      -- CUSTOMER
      -- ---------------------------------------------------

      'customer_name',
        coalesce(
          nullif(
            trim(
              c.customer_name
            ),
            ''
          ),

          nullif(
            trim(
              o.customer_name
            ),
            ''
          ),

          'Customer'
        ),

      'customer_email',
        coalesce(
          nullif(
            trim(
              c.customer_email
            ),
            ''
          ),

          nullif(
            trim(
              o.customer_email
            ),
            ''
          )
        ),

      'customer_contact',
        coalesce(
          nullif(
            trim(
              c.customer_contact
            ),
            ''
          ),

          nullif(
            trim(
              o.customer_contact
            ),
            ''
          )
        ),


      -- ---------------------------------------------------
      -- SERVICE
      -- ---------------------------------------------------

      'service_name',
        coalesce(
          nullif(
            trim(
              c.service_name
            ),
            ''
          ),

          nullif(
            trim(
              o.service_name
            ),
            ''
          )
        ),

      'package_name',
        coalesce(
          nullif(
            trim(
              c.package_name
            ),
            ''
          ),

          nullif(
            trim(
              o.package_name
            ),
            ''
          )
        ),


      -- ---------------------------------------------------
      -- PRODUCT SUPPORT
      -- ---------------------------------------------------

      'product_name',
        c.product_name,

      'product_platform',
        c.product_platform,

      'product_region',
        c.product_region,


      -- ---------------------------------------------------
      -- ORDER
      --
      -- These remain NULL / default until a real order
      -- exists.
      -- ---------------------------------------------------

      'order_id',
        c.order_id,

      'order_reference',
        o.reference,

      'total',
        coalesce(
          o.total,
          0
        ),

      'payment_status',

        case

          when
            o.payment_status is not null
          then
            o.payment_status


          when exists (
            select 1

            from (select r.* from public.service_payment_requests r where r.conversation_id=c.id order by r.created_at desc limit 100) pr

              where pr.status =
                'paid'
          )
          then
            'paid'


          when exists (
            select 1

            from (select r.* from public.service_payment_requests r where r.conversation_id=c.id order by r.created_at desc limit 100) pr

              where pr.status =
                'pending'
          )
          then
            'pending'


          else
            'not_requested'

        end,

      'service_status',
        coalesce(
          o.service_status,
          c.workflow_status
        ),


      -- ---------------------------------------------------
      -- MESSAGES
      -- ---------------------------------------------------

      'messages',

        coalesce(

          (
            select

              jsonb_agg(

                jsonb_build_object(

                  'id',
                    m.id,

                  'sender_type',
                    m.sender_type,

                  'sender_label',
                    m.sender_label,

                  'body',
                    m.body,

                  'message_type',
                    coalesce(
                      m.message_type,
                      'text'
                    ),

                  'metadata',
                    coalesce(
                      m.metadata,
                      '{}'::jsonb
                    ),

                  'created_at',
                    m.created_at

                )

                order by
                  m.created_at,m.id

              )

            from (select sm.* from public.service_messages sm where sm.conversation_id=c.id
              and (p_before is null or (sm.created_at,sm.id)<(select b.created_at,b.id from public.service_messages b where b.id=p_before and b.conversation_id=c.id))
              order by sm.created_at desc,sm.id desc limit 100) m

          ),

          '[]'::jsonb

        ),


      -- ---------------------------------------------------
      -- PAYMENT REQUESTS
      --
      -- These can exist before an Order now.
      -- ---------------------------------------------------

      'payment_requests',

        coalesce(

          (
            select

              jsonb_agg(

                jsonb_build_object(

                  'id',
                    pr.id,

                  'amount',
                    pr.amount,

                  'currency',
                    pr.currency,

                  'title',
                    pr.title,

                  'description',
                    pr.description,

                  'status',
                    pr.status,

                  'created_at',
                    pr.created_at,

                  'paid_at',
                    pr.paid_at,

                  'refund_status',
                    pr.refund_status,

                  'refunded_amount',
                    pr.refunded_amount

                )

                order by
                  pr.created_at

              )

            from (select r.* from public.service_payment_requests r where r.conversation_id=c.id order by r.created_at desc limit 100) pr

          ),

          '[]'::jsonb

        )

    )

  into
    v_result

  from public.service_conversations c

  left join public.orders o

    on
      o.id =
        c.order_id

    and
      o.deleted_at
        is null

  where
    c.id =
      v_conversation_id;


  return v_result || jsonb_build_object('has_older', exists (
    select 1 from public.service_messages older where older.conversation_id=v_conversation_id
    and (older.created_at,older.id)<(select m.created_at,m.id from public.service_messages m where m.id=(v_result->'messages'->0->>'id')::uuid)
  ));

end;
$function$
;
revoke all on function public.birdshop_v3_read_chat(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.birdshop_v3_read_chat(text, uuid, boolean) to service_role;

-- =========================================================
-- 11. FUTURE FUNCTIONS are not browser-executable by default. The global form
--     removes PostgreSQL's built-in PUBLIC grant; the per-schema form removes
--     Supabase's anon/authenticated grants. Migrations still grant explicitly.
-- =========================================================
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
