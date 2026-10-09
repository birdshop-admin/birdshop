-- BirdShop: keep Stripe TEST-mode payments out of every sales figure.
-- All owner reporting (Overview, Analytics, the public "products sold" counter)
-- reads private.birdshop_reporting_orders. Orders paid through a Stripe test
-- checkout (session IDs starting cs_test_) now drop out of that view.
-- Nothing is deleted or changed: the orders, payments and chats stay exactly as
-- they are, and live-mode sales (cs_live_) are unaffected.
begin;

create or replace view private.birdshop_reporting_orders as
select id,reference,customer_name,order_type,order_status,payment_status,
 fulfillment_status,delivery_status,upper(currency) currency,total,
 coalesce(refunded_amount,0) refunded_amount,paid_at,created_at
from public.orders o
where source is distinct from 'admin_test' and paid_at is not null
 and payment_status in ('paid','partially_refunded','refunded')
 -- New: leave out sales paid in Stripe test mode.
 and coalesce(o.payment_reference,'') not like 'cs\_test\_%'
 and not exists (
   select 1 from public.birdshop_checkout_attempts a
   where a.order_id = o.id and a.stripe_session_id like 'cs\_test\_%')
 and not exists (
   select 1 from public.service_payment_requests p
   where p.order_id = o.id
     and (p.stripe_checkout_session_id like 'cs\_test\_%'
       or exists (
         select 1 from public.birdshop_checkout_attempts a
         where a.payment_request_id = p.id and a.status = 'paid'
           and a.stripe_session_id like 'cs\_test\_%')));
revoke all on private.birdshop_reporting_orders from public,anon,authenticated;

create index if not exists birdshop_attempt_order on public.birdshop_checkout_attempts(order_id)
  where order_id is not null;

notify pgrst,'reload schema';
commit;
