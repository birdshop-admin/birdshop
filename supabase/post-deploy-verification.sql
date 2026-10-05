-- Read-only. Run in Supabase SQL Editor after applying the complete migration chain.
-- Every row should say PASS. Do not paste private row contents or secret values into chat.
select name as check_name, case when ok then 'PASS' else 'CHECK REQUIRED' end as result
from (values
 ('final chat migration',to_regprocedure('public.birdshop_v3_read_chat(text,uuid,boolean)') is not null),
 ('staff message idempotency',to_regprocedure('public.birdshop_v3_staff_send_message(uuid,text,uuid)') is not null),
 ('digital finalizer',to_regprocedure('public.birdshop_v2_finalize_product_payment(uuid,text,text,bigint,text)') is not null),
 ('inventory assignment unique',exists(select 1 from pg_indexes where schemaname='public' and tablename='order_fulfillments' and indexdef like '%UNIQUE%' and indexdef like '%(product_inventory_id)%')),
 ('refund bounds installed',exists(select 1 from pg_constraint where conname='birdshop_final_refund_bounds' and convalidated)),
 ('sensitive tables protected by RLS',not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('orders','order_items','service_conversations','service_messages','service_payment_requests','product_inventory','order_fulfillments','birdshop_checkout_attempts','birdshop_stripe_events','birdshop_email_jobs','birdshop_audit_log','admin_users','site_sessions','page_views') and not c.relrowsecurity)),
 ('no anonymous private SECURITY DEFINER access',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname in ('public','private') and (p.proname like 'birdshop_%' or p.proname like 'is_birdshop_%' or n.nspname='private') and has_function_privilege('anon',p.oid,'EXECUTE') and p.proname<>'birdshop_public_store_stats')),
 ('no browser inventory ciphertext access',not has_column_privilege('authenticated','public.product_inventory','code_ciphertext','SELECT')),
 ('no browser delivery job access',not has_table_privilege('authenticated','public.birdshop_email_jobs','SELECT')),
 ('no browser checkout access',not has_table_privilege('authenticated','public.birdshop_checkout_attempts','SELECT')),
 ('refund history within bounds',not exists(select 1 from public.orders where refunded_amount<0 or refunded_amount>total or total<0 or total='NaN'::numeric)),
 ('one active service request',not exists(select 1 from public.service_payment_requests where status in ('pending','processing') group by conversation_id having count(*)>1)),
 ('digital email payloads encrypted',not exists(select 1 from public.birdshop_email_jobs where kind='product_delivery' and payload is not null))
) as checks(name,ok);
