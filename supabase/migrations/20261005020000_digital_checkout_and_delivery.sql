-- Run 2: apply after all Run 1 migrations, at coordinated deployment.
begin;
alter table public.birdshop_checkout_attempts drop constraint birdshop_checkout_attempts_kind_check;
alter table public.birdshop_checkout_attempts drop constraint birdshop_checkout_attempts_payment_request_id_check;
alter table public.birdshop_checkout_attempts add constraint birdshop_checkout_kind check(kind in ('service','product'));
alter table public.birdshop_checkout_attempts add constraint birdshop_checkout_relationship check((kind='service' and payment_request_id is not null) or (kind='product' and payment_request_id is null));
alter table public.birdshop_checkout_attempts add column cart jsonb, add column access_hash text unique;
alter table public.orders add column delivery_status text not null default 'pending' check(delivery_status in ('pending','ready','sending','sent','failed','attention','cancelled')),
 add column disclosure_started_at timestamptz, add column delivery_sent_at timestamptz;
alter table public.birdshop_email_jobs add column encrypted_payload text;
alter table public.birdshop_email_jobs add constraint birdshop_no_plaintext_delivery check(kind<>'product_delivery' or payload is null);
create table if not exists public.birdshop_checkout_inventory (
  attempt_id uuid not null references public.birdshop_checkout_attempts(id) on delete restrict,
  inventory_id uuid primary key references public.product_inventory(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict
);
alter table public.birdshop_checkout_inventory enable row level security;
revoke all on public.birdshop_checkout_inventory from public,anon,authenticated;
grant all on public.birdshop_checkout_inventory to service_role;

create or replace function public.birdshop_v2_begin_product_checkout(p_id uuid,p_cart jsonb,p_email text,p_name text,p_access_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.birdshop_checkout_attempts%rowtype; product public.products%rowtype; item jsonb; snapshot jsonb:='[]'; total_cents bigint:=0; qty integer; code_id uuid; n integer;
begin
  perform private.birdshop_require_server();
  if p_access_hash is null or p_access_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid access hash.'; end if;
  if p_email is null or p_id is null or jsonb_typeof(p_cart) is distinct from 'array' or jsonb_array_length(p_cart) not between 1 and 20 or length(p_email)>320 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(p_name)>120 then raise exception 'Enter a valid cart, name and email.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into a from public.birdshop_checkout_attempts where id=p_id for update;
  if found then
    if a.access_hash is distinct from p_access_hash or a.kind<>'product' or a.customer_email<>lower(trim(p_email)) or
      (select jsonb_agg(jsonb_build_object('id',x->>'id','quantity',(x->>'quantity')::integer) order by x->>'id') from jsonb_array_elements(a.cart) x)
      is distinct from
      (select jsonb_agg(jsonb_build_object('id',x->>'id','quantity',(x->>'quantity')::integer) order by x->>'id') from jsonb_array_elements(p_cart) x) then raise exception 'Checkout does not match.'; end if;
    return to_jsonb(a);
  end if;
  if (select count(*) from jsonb_array_elements(p_cart))<>(select count(distinct x->>'id') from jsonb_array_elements(p_cart) x) then raise exception 'Duplicate cart items.'; end if;
  -- Every inventory mutation locks catalog rows in the same order before code rows.
  perform 1 from public.products where id in(select (x->>'id')::uuid from jsonb_array_elements(p_cart) x) order by id for update;
  for item in select * from jsonb_array_elements(p_cart) loop
    qty:=(item->>'quantity')::integer;
    if qty is null or qty not between 1 and 10 then raise exception 'Choose between 1 and 10 of each item.'; end if;
    select * into product from public.products where id=(item->>'id')::uuid and is_visible;
    if not found or product.inventory_mode<>'keys' then raise exception 'An item is unavailable for automatic delivery. Contact BirdShop for help.'; end if;
    if product.price::text in ('NaN','Infinity','-Infinity') or product.price<0.50 or product.price>999999.99 then raise exception 'Invalid catalog price.'; end if;
    snapshot:=snapshot||jsonb_build_array(jsonb_build_object('id',product.id,'slug',product.slug,'name',product.name,'platform',product.platform,'region',product.region,'quantity',qty,'unit_cents',round(product.price*100)::bigint,'line_cents',round(product.price*100)::bigint*qty,'currency','usd'));
    total_cents:=total_cents+round(product.price*100)::bigint*qty;
  end loop;
  if total_cents<50 or total_cents>99999999 then raise exception 'Cart total is outside the supported range.'; end if;
  insert into public.birdshop_checkout_attempts(id,kind,expected_cents,customer_name,customer_email,cart,access_hash)
    values(p_id,'product',total_cents,coalesce(nullif(trim(p_name),''),'Customer'),lower(trim(p_email)),snapshot,p_access_hash) returning * into a;
  for item in select * from jsonb_array_elements(snapshot) order by value->>'id' loop
    n:=0;
    for code_id in select id from public.product_inventory where product_id=(item->>'id')::uuid and status='available' order by created_at,id for update skip locked limit (item->>'quantity')::integer loop
      insert into public.birdshop_checkout_inventory(attempt_id,inventory_id,product_id) values(a.id,code_id,(item->>'id')::uuid);
      update public.product_inventory set status='reserved',reserved_reference='checkout:'||a.id,reserved_at=now() where id=code_id;
      n:=n+1;
    end loop;
    if n<>(item->>'quantity')::integer then raise exception 'Not enough stock for %. Your cart has not been charged.',item->>'name'; end if;
  end loop;
  return to_jsonb(a);
end $$;

create or replace function public.birdshop_v2_close_checkout(p_attempt_id uuid,p_state text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.birdshop_checkout_attempts%rowtype; p public.service_payment_requests%rowtype; c_id uuid;
begin
  perform private.birdshop_require_server();
  if p_state is null or p_state not in ('expired','failed') then raise exception 'Invalid terminal checkout state.'; end if;
  select p0.conversation_id into c_id from public.birdshop_checkout_attempts a0 join public.service_payment_requests p0 on p0.id=a0.payment_request_id where a0.id=p_attempt_id;
  if c_id is not null then
    perform 1 from public.service_conversations where id=c_id for update;
    select * into p from public.service_payment_requests where id=(select payment_request_id from public.birdshop_checkout_attempts where id=p_attempt_id) for update;
  end if;
  select * into a from public.birdshop_checkout_attempts where id=p_attempt_id for update;
  if not found or a.stripe_session_id is null then raise exception 'Verify the Stripe session before closing a checkout.'; end if;
  if a.status='paid' or a.order_id is not null then return; end if;
  if a.status in ('expired','failed','cancelled') then return; end if;
  if a.kind='product' then
    perform 1 from public.products where id in(select product_id from public.birdshop_checkout_inventory where attempt_id=a.id) order by id for update;
    update public.product_inventory set status='available',reserved_reference=null,reserved_at=null
      where id in(select inventory_id from public.birdshop_checkout_inventory where attempt_id=a.id) and status='reserved' and reserved_reference='checkout:'||a.id;
    delete from public.birdshop_checkout_inventory where attempt_id=a.id;
  elsif p.order_id is null and p.status<>'paid' then
    if a.cancel_requested_at is not null then
      update public.service_payment_requests set status='cancelled',cancelled_at=now() where id=p.id;
      update public.service_conversations set workflow_status=coalesce(p.previous_workflow_status,'discussing') where id=c_id and order_id is null;
      insert into public.service_messages(conversation_id,sender_type,sender_label,body,message_type) values(c_id,'system','BirdShop','Payment request cancelled. Your conversation remains available.','system');
    else
      update public.service_payment_requests set status='pending',stripe_checkout_session_id=null,stripe_checkout_url=null,stripe_payment_status=p_state where id=p.id and stripe_checkout_session_id=a.stripe_session_id;
    end if;
  end if;
  update public.birdshop_checkout_attempts set status=case when cancel_requested_at is not null then 'cancelled' else p_state end where id=a.id;
end $$;

create or replace function public.birdshop_v2_abandon_unstarted_checkout(p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.birdshop_checkout_attempts%rowtype; c_id uuid;
begin
 perform private.birdshop_require_server();
 select p.conversation_id into c_id from public.birdshop_checkout_attempts x join public.service_payment_requests p on p.id=x.payment_request_id where x.id=p_attempt_id;
 if c_id is not null then
  perform 1 from public.service_conversations where id=c_id for update;
  perform 1 from public.service_payment_requests where id=(select payment_request_id from public.birdshop_checkout_attempts where id=p_attempt_id) for update;
 end if;
 select * into a from public.birdshop_checkout_attempts where id=p_attempt_id for update;
 if not found or a.status not in ('creating','attention') or a.stripe_params is not null or a.stripe_session_id is not null or a.order_id is not null or a.expires_at>now() then return false; end if;
 perform 1 from public.products where id in(select product_id from public.birdshop_checkout_inventory where attempt_id=a.id) order by id for update;
 update public.product_inventory set status='available',reserved_reference=null,reserved_at=null
  where id in(select inventory_id from public.birdshop_checkout_inventory where attempt_id=a.id) and status='reserved' and reserved_reference='checkout:'||a.id;
 delete from public.birdshop_checkout_inventory where attempt_id=a.id;
 update public.birdshop_checkout_attempts set status='failed' where id=a.id;
 return true;
end $$;


create or replace function public.birdshop_v2_allocate_product_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; a public.birdshop_checkout_attempts%rowtype; item public.order_items%rowtype; code_id uuid; needed integer; available integer;
begin
 perform private.birdshop_require_server();
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.order_type<>'product' or o.paid_at is null or o.payment_status not in ('paid','partially_refunded') then raise exception 'Paid digital order required.'; end if;
 if o.delivery_status='sent' then return true;end if;
 select * into a from public.birdshop_checkout_attempts where order_id=o.id;
 perform 1 from public.products where id in(select product_id from public.order_items where order_id=o.id) order by id for update;
 -- This subtransaction rolls back every new assignment if any line lacks stock.
 begin
  for item in select * from public.order_items where order_id=o.id order by product_id,id loop
   select item.quantity-count(*)::integer into needed from public.order_fulfillments where order_item_id=item.id;
   if needed<0 then raise exception 'Invalid allocation count.'; end if;
   for code_id in select i.id from public.product_inventory i where i.product_id=item.product_id
    and not exists(select 1 from public.order_fulfillments f where f.product_inventory_id=i.id)
    and (i.status='available' or (i.status='reserved' and i.reserved_reference='checkout:'||a.id))
    order by (i.reserved_reference='checkout:'||a.id) desc nulls last,i.created_at,i.id for update skip locked limit needed loop
    insert into public.order_fulfillments(order_id,order_item_id,product_inventory_id) values(o.id,item.id,code_id);
    update public.product_inventory set status='sold',sold_at=coalesce(sold_at,now()),reserved_reference=o.reference,reserved_at=coalesce(reserved_at,now()) where id=code_id;
    needed:=needed-1;
   end loop;
   if needed<>0 then raise exception using errcode='P0002',message='Stock requires attention.'; end if;
  end loop;
 exception when no_data_found then
  update public.orders set delivery_status='attention',fulfillment_status='unfulfilled' where id=o.id;
  return false;
 end;
 update public.orders set fulfillment_status='reserved',delivery_status=case when delivery_status in ('sent','sending') then delivery_status else 'ready' end where id=o.id;
 insert into public.birdshop_email_jobs(dedupe_key,kind,entity_id) values('delivery/'||o.id,'product_delivery',o.id) on conflict(dedupe_key) do nothing;
 return true;
end $$;

create or replace function public.birdshop_v2_finalize_product_payment(p_attempt_id uuid,p_session_id text,p_intent_id text,p_amount bigint,p_currency text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.birdshop_checkout_attempts%rowtype; item jsonb; v_order uuid;
begin
 perform private.birdshop_require_server();
 select * into a from public.birdshop_checkout_attempts where id=p_attempt_id for update;
 if not found or a.kind<>'product' or a.stripe_session_id is distinct from p_session_id or a.expected_cents is distinct from p_amount or a.currency is distinct from lower(p_currency) or nullif(p_intent_id,'') is null then raise exception 'Payment identity mismatch.'; end if;
 if a.order_id is not null then
  if a.payment_intent_id is distinct from p_intent_id then raise exception 'Payment identity mismatch.'; end if;
  return a.order_id;
 end if;
 insert into public.orders(customer_name,customer_email,order_type,source,currency) values(a.customer_name,a.customer_email,'product','product_checkout',upper(a.currency)) returning id into v_order;
 for item in select * from jsonb_array_elements(a.cart) loop
  insert into public.order_items(order_id,product_id,product_slug,product_name,product_platform,product_region,unit_price,quantity,line_total)
   values(v_order,(item->>'id')::uuid,item->>'slug',item->>'name',item->>'platform',item->>'region',(item->>'unit_cents')::numeric/100,(item->>'quantity')::integer,(item->>'line_cents')::numeric/100);
 end loop;
 update public.orders set order_status='active',payment_status='paid',subtotal=a.expected_cents::numeric/100,total=a.expected_cents::numeric/100,payment_provider='stripe',payment_reference=p_intent_id,paid_at=now() where id=v_order;
 update public.birdshop_checkout_attempts set status='paid',order_id=v_order,payment_intent_id=p_intent_id where id=a.id;
 -- Payment remains committed even when allocation needs more stock.
 begin
  perform public.birdshop_v2_allocate_product_order(v_order);
 exception when others then
  update public.orders set delivery_status='attention',fulfillment_status='unfulfilled' where id=v_order;
  insert into public.birdshop_audit_log(action,entity_id,details) values('allocation_error',v_order,jsonb_build_object('code',sqlstate));
 end;
 insert into public.birdshop_email_jobs(dedupe_key,kind,entity_id) values('receipt/admin/'||v_order,'admin_payment',v_order) on conflict(dedupe_key) do nothing;
 return v_order;
end $$;

create or replace function public.birdshop_v2_prepare_delivery(p_job_id uuid,p_lease_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.birdshop_email_jobs%rowtype; o public.orders%rowtype;
begin
 perform private.birdshop_require_server();
 select * into j from public.birdshop_email_jobs where id=p_job_id;
 select * into o from public.orders where id=j.entity_id for update;
 select * into j from public.birdshop_email_jobs where id=p_job_id for update;
 if j.kind<>'product_delivery' or j.lease_id is distinct from p_lease_id or j.status<>'sending' or j.lease_until<=now() then raise exception 'Delivery lease changed.'; end if;
 if o.paid_at is null or o.payment_status not in ('paid','partially_refunded') or o.fulfillment_status not in ('reserved','fulfilled') then
  update public.birdshop_email_jobs set status='attention',last_error='Delivery paused for order review.',lease_id=null,lease_until=null where id=j.id;
  return false;
 end if;
 update public.orders set disclosure_started_at=coalesce(disclosure_started_at,now()),delivery_status='sending' where id=o.id;
 return true;
end $$;

create or replace function public.birdshop_v2_finish_delivery(p_job_id uuid,p_lease_id uuid,p_provider_id text)
returns void language plpgsql security definer set search_path='' as $$
declare j public.birdshop_email_jobs%rowtype;
begin
 perform private.birdshop_require_server();
 select * into j from public.birdshop_email_jobs where id=p_job_id;
 perform 1 from public.orders where id=j.entity_id for update;
 select * into j from public.birdshop_email_jobs where id=p_job_id for update;
 if j.kind<>'product_delivery' or j.lease_id is distinct from p_lease_id or j.status<>'sending' or nullif(p_provider_id,'') is null then raise exception 'Delivery lease changed.'; end if;
 update public.birdshop_email_jobs set status='sent',sent_at=now(),provider_id=p_provider_id,lease_id=null,lease_until=null,last_error=null where id=j.id;
 update public.orders set delivery_status='sent',delivery_sent_at=coalesce(delivery_sent_at,now()),fulfillment_status='fulfilled',fulfilled_at=coalesce(fulfilled_at,now()),order_status=case when payment_status='refunded' then order_status else 'completed' end where id=j.entity_id;
 update public.order_fulfillments set delivered_at=coalesce(delivered_at,now()) where order_id=j.entity_id;
 insert into public.birdshop_audit_log(action,entity_id) values('delivery_provider_accepted',j.entity_id);
end $$;

-- Extend refund behavior without replacing Run 1's validated financial reconciliation.
alter function public.birdshop_sync_service_refund(text,text,bigint,text,boolean) rename to birdshop_run1_sync_refund;
create function public.birdshop_sync_service_refund(p_payment_intent_id text,p_charge_id text,p_amount_refunded bigint,p_currency text,p_is_fully_refunded boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; o public.orders%rowtype;
begin
 perform private.birdshop_require_server();
 oid:=public.birdshop_run1_sync_refund(p_payment_intent_id,p_charge_id,p_amount_refunded,p_currency,p_is_fully_refunded);
 if oid is null then return null; end if;
 select * into o from public.orders where id=oid for update;
 if o.order_type='product' and o.payment_status='refunded' then
  update public.birdshop_email_jobs set status='attention',last_error='Full refund: delivery stopped or requires provider review.',lease_id=case when status='sending' then lease_id else null end,lease_until=case when status='sending' then lease_until else null end
   where entity_id=oid and kind='product_delivery' and status in ('queued','failed');
  update public.orders set delivery_status=case when disclosure_started_at is null then 'cancelled' when delivery_status='sent' then 'sent' else 'attention' end where id=oid;
 end if;
 return oid;
end $$;

create or replace function private.birdshop_protect_checkout_hold() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if coalesce(auth.role(),'')<>'service_role' and exists(select 1 from public.birdshop_checkout_inventory where inventory_id=old.id) then raise exception 'Checkout owns this code.'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger birdshop_v2_checkout_hold before update or delete on public.product_inventory for each row execute function private.birdshop_protect_checkout_hold();

do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('birdshop_v2_begin_product_checkout','birdshop_v2_close_checkout','birdshop_v2_abandon_unstarted_checkout','birdshop_v2_allocate_product_order','birdshop_v2_finalize_product_payment','birdshop_v2_prepare_delivery','birdshop_v2_finish_delivery','birdshop_sync_service_refund','birdshop_run1_sync_refund') loop
  execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
revoke all on function private.birdshop_protect_checkout_hold() from public,anon,authenticated;

create function public.birdshop_v2_requeue_product_delivery(p_order_id uuid,p_actor_id uuid,p_reviewed boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare j public.birdshop_email_jobs%rowtype; o public.orders%rowtype;begin
 perform private.birdshop_require_server();
 if not exists(select 1 from public.admin_users where user_id=p_actor_id and role='owner' and is_active) then raise exception 'Active owner required.';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not public.birdshop_v2_allocate_product_order(p_order_id) then
  insert into public.birdshop_audit_log(actor_id,action,entity_id) values(p_actor_id,'allocation_needs_stock',p_order_id);return;
 end if;
 select * into j from public.birdshop_email_jobs where kind='product_delivery' and entity_id=p_order_id order by created_at desc limit 1 for update;
 if j.status='sending' and j.lease_until>now() then raise exception 'Delivery already in progress.';end if;
 if j.status='sent' then raise exception 'Delivery already sent. Use the existing email.';end if;
 if j.status='attention' or j.first_attempt_at<now()-interval '23 hours' then
  if not p_reviewed then raise exception 'Check provider history and confirm before resending.';end if;
  insert into public.birdshop_email_jobs(dedupe_key,kind,entity_id,encrypted_payload) values('manual/'||j.id,'product_delivery',p_order_id,j.encrypted_payload) on conflict(dedupe_key) do nothing;
 else
  update public.birdshop_email_jobs set status='queued',lease_id=null,lease_until=null,next_attempt_at=now() where id=j.id;
 end if;
 insert into public.birdshop_audit_log(actor_id,action,entity_id,details) values(p_actor_id,'delivery_retry',p_order_id,jsonb_build_object('reviewed',p_reviewed));
end $$;
revoke all on function public.birdshop_v2_requeue_product_delivery(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.birdshop_v2_requeue_product_delivery(uuid,uuid,boolean) to service_role;

alter function public.birdshop_v2_record_charge(text,text,bigint,text) rename to birdshop_run1_record_charge;
create function public.birdshop_v2_record_charge(p_intent_id text,p_charge_id text,p_amount bigint,p_currency text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;begin
 perform private.birdshop_require_server();
 select * into o from public.orders where payment_provider='stripe' and payment_reference=p_intent_id;
 if o.order_type is distinct from 'product' then perform public.birdshop_run1_record_charge(p_intent_id,p_charge_id,p_amount,p_currency);return;end if;
 select * into o from public.orders where id=o.id for update;
 if nullif(p_charge_id,'') is null or round(o.total*100)::bigint is distinct from p_amount or lower(o.currency) is distinct from lower(p_currency) or (o.stripe_charge_id is not null and o.stripe_charge_id<>p_charge_id) then raise exception 'Charge mismatch.';end if;
 update public.orders set stripe_charge_id=p_charge_id where id=o.id;
end $$;
alter function public.birdshop_record_service_refund_failure(text,text,text,text) rename to birdshop_run1_refund_failure;
create function public.birdshop_record_service_refund_failure(p_payment_intent_id text,p_charge_id text,p_refund_id text,p_failure_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;begin
 perform private.birdshop_require_server();
 select * into o from public.orders where payment_provider='stripe' and payment_reference=p_payment_intent_id;
 if o.order_type is distinct from 'product' then return public.birdshop_run1_refund_failure(p_payment_intent_id,p_charge_id,p_refund_id,p_failure_reason);end if;
 if nullif(p_refund_id,'') is null then raise exception 'Refund identity required.';end if;
 insert into public.birdshop_audit_log(action,entity_id,details) values('refund_failure',o.id,jsonb_build_object('refund_id',p_refund_id,'order_id',o.id)) on conflict do nothing;
 return o.id;
end $$;
revoke all on function public.birdshop_v2_record_charge(text,text,bigint,text),public.birdshop_record_service_refund_failure(text,text,text,text) from public,anon,authenticated;
grant execute on function public.birdshop_v2_record_charge(text,text,bigint,text),public.birdshop_record_service_refund_failure(text,text,text,text) to service_role;
create unique index birdshop_checkout_order_once on public.birdshop_checkout_attempts(order_id) where order_id is not null;
create function private.birdshop_protect_digital_delivery() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if old.order_type='product' and old.payment_provider='stripe' and coalesce(auth.role(),'')<>'service_role' and
 (new.delivery_status,new.disclosure_started_at,new.delivery_sent_at,new.fulfillment_status,new.fulfilled_at) is distinct from
 (old.delivery_status,old.disclosure_started_at,old.delivery_sent_at,old.fulfillment_status,old.fulfilled_at) then raise exception 'Trusted fulfillment worker required.';end if;
 return new;
end $$;
create trigger birdshop_protect_digital_delivery before update on public.orders for each row execute function private.birdshop_protect_digital_delivery();
revoke all on function private.birdshop_protect_digital_delivery() from public,anon,authenticated;
create or replace function private.birdshop_protect_history() returns trigger language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_id uuid;
begin
  if tg_table_name='orders' then
    if tg_op='DELETE' and private.birdshop_is_financial(old) then raise exception 'Financial orders are retained. Use Archive or soft Delete.'; end if;
    if tg_op='UPDATE' and private.birdshop_is_financial(old) then
      if (new.source,new.payment_provider,new.payment_reference,new.total,new.subtotal,new.currency,new.customer_email) is distinct from (old.source,old.payment_provider,old.payment_reference,old.total,old.subtotal,old.currency,old.customer_email) then raise exception 'Recorded financial details cannot be rewritten.'; end if;
      if coalesce(auth.role(),'')<>'service_role' and (new.payment_status,new.paid_at,new.refunded_amount,new.stripe_charge_id) is distinct from (old.payment_status,old.paid_at,old.refunded_amount,old.stripe_charge_id) then raise exception 'Payment changes require verified server reconciliation.'; end if;
    end if;
  elsif tg_table_name='service_conversations' then
    if old.order_id is not null and exists(select 1 from public.orders o where o.id=old.order_id and private.birdshop_is_financial(o)) then raise exception 'Financial conversation history is retained.';end if;
    if exists(select 1 from public.service_payment_requests where conversation_id=old.id and (order_id is not null or paid_at is not null or stripe_checkout_session_id is not null)) then raise exception 'Payment conversation history is retained. Use soft Delete.'; end if;
  elsif tg_table_name='service_payment_requests' then
    if old.order_id is not null or old.paid_at is not null or old.stripe_checkout_session_id is not null or old.stripe_payment_intent_id is not null or old.stripe_payment_intent is not null or old.stripe_charge_id is not null or old.refunded_amount>0 then raise exception 'Payment history is retained.'; end if;
  else
    v_id:=old.order_id;
    select * into v_order from public.orders where id=v_id;
    if found and private.birdshop_is_financial(v_order) then
      -- Product deletion may only clear an item's catalog FK; its purchased snapshot remains.
      if tg_table_name='order_items' and tg_op='UPDATE' then
       if (new.product_id is null or new.product_id=old.product_id) and (to_jsonb(new)-'product_id'-'updated_at')=(to_jsonb(old)-'product_id'-'updated_at') then return new;end if;
      end if;
      if tg_table_name='order_fulfillments' and tg_op='UPDATE' then
       if new.order_id=old.order_id and new.order_item_id=old.order_item_id and new.product_inventory_id=old.product_inventory_id and (old.delivered_at is null or new.delivered_at is not distinct from old.delivered_at) then return new;end if;
      end if;
      raise exception 'Purchased items and allocated codes are retained.';
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;


create function private.birdshop_protect_paid_item_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;begin
 select * into o from public.orders where id=new.order_id;
 if private.birdshop_is_financial(o) then raise exception 'Purchased item snapshots cannot be extended.';end if;
 return new;
end $$;
create trigger birdshop_protect_paid_item_insert before insert on public.order_items for each row execute function private.birdshop_protect_paid_item_insert();
revoke all on function private.birdshop_protect_paid_item_insert() from public,anon,authenticated;
commit;
