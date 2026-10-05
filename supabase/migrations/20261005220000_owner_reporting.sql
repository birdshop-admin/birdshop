begin;

-- One definition for legitimate historical sales. Archive/deletion flags are
-- intentionally absent: organization must not rewrite financial history.
create or replace view private.birdshop_reporting_orders as
select id,reference,customer_name,order_type,order_status,payment_status,
 fulfillment_status,delivery_status,upper(currency) currency,total,
 coalesce(refunded_amount,0) refunded_amount,paid_at,created_at
from public.orders
where source is distinct from 'admin_test' and paid_at is not null
 and payment_status in ('paid','partially_refunded','refunded');
revoke all on private.birdshop_reporting_orders from public,anon,authenticated;

create index if not exists birdshop_report_paid on public.orders(paid_at) where paid_at is not null;
create index if not exists birdshop_report_views on public.page_views(created_at,session_id);
create index if not exists birdshop_report_presence on public.site_sessions(last_seen);
create index if not exists birdshop_report_latest_message on public.service_messages(conversation_id,created_at desc);

create or replace function public.birdshop_admin_report(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_start timestamptz; v_end timestamptz := now(); v_bucket text; v_first timestamp; result jsonb;
begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
 if p_days is not null and p_days not in (7,30,90) then raise exception 'Invalid period.'; end if;
 v_start := case when p_days is null then null else
  (date_trunc('day',now() at time zone 'UTC')-make_interval(days=>p_days-1)) at time zone 'UTC' end;
 v_bucket := case when p_days is null then 'month' else 'day' end;
 v_first := case when p_days is null then date_trunc('month',least(
   coalesce((select min(paid_at) from private.birdshop_reporting_orders),now()),
   coalesce((select min(created_at) from public.page_views),now())) at time zone 'UTC')
  else v_start at time zone 'UTC' end;

 with sales as materialized (
   select * from private.birdshop_reporting_orders where (v_start is null or paid_at>=v_start) and paid_at<=v_end
 ), views as materialized (
   select created_at,session_id from public.page_views where (v_start is null or created_at>=v_start) and created_at<=v_end
 ), totals as (
   select currency,count(*) paid_orders,sum(total) gross,sum(refunded_amount) refunds,
    sum(total-refunded_amount) net,round(avg(total),2) average_order,
    count(*) filter(where order_type='product') digital_orders,
    count(*) filter(where order_type='service') service_orders,
    coalesce(sum(total-refunded_amount) filter(where order_type='product'),0) digital_net,
    coalesce(sum(total-refunded_amount) filter(where order_type='service'),0) service_net
   from sales group by currency
 ), financial as (
   select date_trunc(v_bucket,paid_at at time zone 'UTC') bucket,currency,
    sum(total) gross,sum(refunded_amount) refunds,sum(total-refunded_amount) net,count(*) paid_orders
   from sales group by 1,2
 ), traffic as (
   select date_trunc(v_bucket,created_at at time zone 'UTC') bucket,count(*) views,
    count(distinct session_id) visitors from views group by 1
 ), units as (
   select date_trunc(v_bucket,o.paid_at at time zone 'UTC') bucket,sum(i.quantity) units
   from sales o join public.order_items i on i.order_id=o.id where o.order_type='product' group by 1
 ), series as (
   select d::date as day,coalesce(t.views,0) views,coalesce(t.visitors,0) visitors,coalesce(u.units,0) units,
    coalesce((select sum(f.paid_orders) from financial f where f.bucket=d),0) paid_orders,
    coalesce((select jsonb_agg(to_jsonb(f)-'bucket' order by currency) from financial f where f.bucket=d),'[]'::jsonb) revenue
   from generate_series(v_first,date_trunc(v_bucket,now() at time zone 'UTC'),
    case when v_bucket='month' then interval '1 month' else interval '1 day' end) d
   left join traffic t on t.bucket=d left join units u on u.bucket=d
 ), products as (
   select i.product_id,i.product_name,o.currency,sum(i.quantity) units,sum(i.line_total) gross
   from sales o join public.order_items i on i.order_id=o.id where o.order_type='product'
   group by i.product_id,i.product_name,o.currency order by sum(i.quantity) desc,sum(i.line_total) desc limit 12
 )
 select jsonb_build_object(
   'period_days',p_days,'bucket',v_bucket,'updated_at',v_end,
   'paid_orders',(select count(*) from sales),
   'units',(select coalesce(sum(i.quantity),0) from sales o join public.order_items i on i.order_id=o.id where o.order_type='product'),
   'views',(select count(*) from views),'visitors',(select count(distinct session_id) from views),
   'revenue',coalesce((select jsonb_agg(t order by currency) from totals t),'[]'::jsonb),
   'series',coalesce((select jsonb_agg(s order by day) from series s),'[]'::jsonb),
   'products',coalesce((select jsonb_agg(p) from products p),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create or replace function public.birdshop_admin_overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
 with chats as materialized (
   select c.* from public.service_conversations c where c.source is distinct from 'admin_test' and c.deleted_at is null
 ), stock as (
   select p.id,p.name,count(i.id) filter(where i.status='available') available
   from public.products p left join public.product_inventory i on i.product_id=p.id
   where p.is_visible and p.inventory_mode='keys' group by p.id,p.name
 ), activity as (
   select 'conversation' kind,c.reference title,c.conversation_type::text detail,c.created_at occurred_at,
    '/admin/chat?conversation='||c.id::text href from chats c
   union all
   select 'payment',o.reference,o.order_type||' payment received',o.paid_at,
    '/admin/orders?view='||case when o.order_type='product' then 'digital' else 'services' end
   from private.birdshop_reporting_orders o
   union all
   select 'review',r.title,r.status::text,r.created_at,'/admin/reviews' from public.reviews r
 )
 select jsonb_build_object(
  'updated_at',now(),
  'revenue',coalesce((select jsonb_agg(x order by currency) from (
   select currency,sum(total) gross,sum(refunded_amount) refunds,sum(total-refunded_amount) net
   from private.birdshop_reporting_orders group by currency)x),'[]'::jsonb),
  'paid_orders',(select count(*) from private.birdshop_reporting_orders),
  'units',(select coalesce(sum(i.quantity),0) from private.birdshop_reporting_orders o join public.order_items i on i.order_id=o.id where o.order_type='product'),
  'live_now',(select count(*) from public.site_sessions where last_seen>=now()-interval '2 minutes'),
  'open_chats',(select count(*) from chats where status='open'),
  'awaiting_reply',(select count(*) from chats c where c.status='open' and
   (select m.sender_type from public.service_messages m where m.conversation_id=c.id and m.sender_type in ('customer','admin') order by m.created_at desc,m.id desc limit 1)='customer'),
  'assigned_chats',(select count(*) from chats where status='open' and assigned_staff_user_id is not null),
  'paid_services',(select count(*) from private.birdshop_reporting_orders where order_type='service' and order_status in ('pending','active') and payment_status<>'refunded'),
  'delivery_issues',(select count(*) from private.birdshop_reporting_orders where order_type='product' and (delivery_status in ('failed','attention') or fulfillment_status='attention')),
  'pending_digital',(select count(*) from private.birdshop_reporting_orders where order_type='product' and delivery_status in ('pending','ready','sending')),
  'email_issues',(select count(*) from public.birdshop_email_jobs where status in ('failed','attention')),
  'payment_issues',(select count(*) from public.birdshop_checkout_attempts where status='attention') +
   (select count(*) from public.birdshop_stripe_events where processed_at is null and created_at<now()-interval '5 minutes'),
  'inventory',jsonb_build_object(
   'available',(select count(*) from public.product_inventory where status='available'),
   'reserved',(select count(*) from public.product_inventory where status='reserved'),
   'sold',(select count(*) from public.product_inventory where status='sold')),
  'low_stock_count',(select count(*) from stock where available<=3),
  'low_stock',coalesce((select jsonb_agg(x) from (select name,available from stock where available<=3 order by available,name limit 8)x),'[]'::jsonb),
  'recent_orders',coalesce((select jsonb_agg(x) from (
   select reference,customer_name,order_type,payment_status,delivery_status,order_status,total,currency,paid_at
   from private.birdshop_reporting_orders order by paid_at desc limit 6)x),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(x) from (select * from activity order by occurred_at desc limit 8)x),'[]'::jsonb)
 ) into result;
 return result;
end $$;

-- Retain the public counter contract, sharing the same paid-order definition.
create or replace function public.birdshop_public_store_stats()
returns table(products_sold bigint) language sql stable security definer set search_path='' as $$
 select coalesce(sum(i.quantity),0)::bigint from private.birdshop_reporting_orders o
 join public.order_items i on i.order_id=o.id where o.order_type='product';
$$;
revoke all on function public.birdshop_admin_report(integer),public.birdshop_admin_overview() from public,anon,authenticated;
grant execute on function public.birdshop_admin_report(integer),public.birdshop_admin_overview() to authenticated;
-- Compatibility adapters for an already-open tab / previous deployment.
-- Business calculations live only in birdshop_admin_report and the shared view.
create or replace function public.birdshop_v2_analytics_series(p_days integer default 30)
returns jsonb language sql stable security definer set search_path='' as $$
 select public.birdshop_admin_report(p_days)->'series';
$$;
create or replace function public.birdshop_v2_sales_stats()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare all_report jsonb; week_report jsonb; month_report jsonb;
begin
 all_report:=public.birdshop_admin_report(null);
 week_report:=public.birdshop_admin_report(7);
 month_report:=public.birdshop_admin_report(30);
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'currency',r->>'currency','gross_revenue',r->'gross','refunds',r->'refunds',
  'net_revenue',r->'net','paid_orders',r->'paid_orders',
  'product_net_revenue',r->'digital_net','service_net_revenue',r->'service_net',
  'net_7d',coalesce((select x->'net' from jsonb_array_elements(week_report->'revenue') x where x->>'currency'=r->>'currency'),'0'::jsonb),
  'net_30d',coalesce((select x->'net' from jsonb_array_elements(month_report->'revenue') x where x->>'currency'=r->>'currency'),'0'::jsonb)
  )),'[]'::jsonb) from jsonb_array_elements(all_report->'revenue') r);
end $$;
create or replace function public.birdshop_admin_site_analytics()
returns table(online_now bigint, views_7d bigint, views_30d bigint, views_all bigint, visitors_7d bigint, visitors_30d bigint, visitors_all bigint)
language plpgsql stable security definer set search_path='' as $$
declare a jsonb; w jsonb; m jsonb;
begin
 a:=public.birdshop_admin_report(null); w:=public.birdshop_admin_report(7); m:=public.birdshop_admin_report(30);
 return query select (select count(*) from public.site_sessions where last_seen>=now()-interval '2 minutes'),
 (w->>'views')::bigint,(m->>'views')::bigint,(a->>'views')::bigint,
 (w->>'visitors')::bigint,(m->>'visitors')::bigint,(a->>'visitors')::bigint;
end $$;
revoke all on function public.birdshop_v2_sales_stats(), public.birdshop_v2_analytics_series(integer),public.birdshop_admin_site_analytics() from public,anon;

notify pgrst,'reload schema';
commit;
