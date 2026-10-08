-- Read-only. Run in the Supabase SQL Editor after 20261008120000_production_readiness.sql.
-- Every row should say PASS. Do not paste private row contents or secret values into chat.
select name as check_name, case when ok then 'PASS' else 'CHECK REQUIRED' end as result
from (values
 ('products RLS enabled', (select relrowsecurity from pg_class where oid = 'public.products'::regclass)),
 ('products: no browser-anonymous writes',
   not has_table_privilege('anon', 'public.products', 'INSERT')
   and not has_table_privilege('anon', 'public.products', 'UPDATE')
   and not has_table_privilege('anon', 'public.products', 'DELETE')),
 ('products: only owner write policy',
   not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products'
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL') and policyname <> 'birdshop_products_owner_manage')),
 ('order status function is owner-gated',
   pg_get_functiondef('public.birdshop_set_service_order_status(uuid,text,text)'::regprocedure) like '%is_birdshop_owner()%'),
 ('order completion queues one email',
   pg_get_functiondef('public.birdshop_set_service_order_status(uuid,text,text)'::regprocedure) like '%completed/customer/%'),
 ('support request deletion is owner-gated',
   pg_get_functiondef('public.birdshop_permanently_delete_support_request(uuid)'::regprocedure) like '%is_birdshop_owner()%'),
 ('test service orders are owner-gated',
   pg_get_functiondef('public.birdshop_admin_create_test_service_order(text,text,text,text,numeric,text)'::regprocedure) like '%is_birdshop_owner()%'),
 ('deactivated staff excluded from is_birdshop_admin',
   pg_get_functiondef('public.is_birdshop_admin()'::regprocedure) like '%is_active%'),
 ('is_birdshop_owner checks active owner (review if CHECK REQUIRED)',
   pg_get_functiondef('public.is_birdshop_owner()'::regprocedure) like '%is_active%'),
 ('service role can disable inventory codes', has_column_privilege('service_role', 'public.product_inventory', 'status', 'UPDATE')),
 ('one code per fulfillment (unique index)',
   exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'order_fulfillments'
     and indexdef like '%UNIQUE%' and indexdef like '%(product_inventory_id)%')),
 ('one order per Stripe PaymentIntent (unique index)',
   exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'orders_stripe_intent_once')),
 ('one payment request per PaymentIntent (unique index)',
   exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'service_payment_requests_intent_once')),
 ('stale checkout release installed (server only)',
   to_regprocedure('public.birdshop_v2_release_stale_checkout(uuid)') is not null
   and not has_function_privilege('anon', 'public.birdshop_v2_release_stale_checkout(uuid)', 'EXECUTE')
   and not has_function_privilege('authenticated', 'public.birdshop_v2_release_stale_checkout(uuid)', 'EXECUTE')),
 ('customer chat shows refunds',
   pg_get_functiondef('public.birdshop_v3_read_chat(text,uuid,boolean)'::regprocedure) like '%refund_status%'),
 ('refunded orders cannot be reopened',
   pg_get_functiondef('public.birdshop_set_service_order_status(uuid,text,text)'::regprocedure) like '%Refunded orders cannot change status%'),
 ('admin operations report installed', to_regprocedure('public.birdshop_admin_operations()') is not null),
 ('admin operations report not anonymous', not has_function_privilege('anon', 'public.birdshop_admin_operations()', 'EXECUTE')),
 ('realtime publishes chat queue tables',
   (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('service_messages', 'service_conversations', 'service_payment_requests', 'orders')) = 4),
 ('no anonymous SECURITY DEFINER access (BirdShop)',
   not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef and n.nspname in ('public', 'private')
       and (p.proname like 'birdshop_%' or p.proname like 'is_birdshop_%' or n.nspname = 'private')
       and has_function_privilege('anon', p.oid, 'EXECUTE')
       and p.proname not in ('birdshop_public_store_stats'))),
 ('completed orders are always paid',
   not exists (select 1 from public.orders where order_type = 'service' and service_status = 'completed'
     and source is distinct from 'admin_test' and payment_status not in ('paid', 'partially_refunded', 'refunded')))
) as checks(name, ok);

-- Review manually: every SECURITY DEFINER function a signed-in (non-staff) user can call.
-- Each must check is_birdshop_owner() / active staff assignment internally.
select p.oid::regprocedure as callable_by_authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
order by 1;
