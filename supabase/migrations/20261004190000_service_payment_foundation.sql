-- BirdShop RUN 1 foundation. PENDING: do not apply before all three runs are complete.
-- Baseline 20261002220000 is already applied and must not be rerun in production.
-- Additive state + replacement RPCs. No customer/order/inventory data is deleted.
begin;
create schema if not exists private;

create table if not exists public.birdshop_rate_limits (
  key text primary key, window_start timestamptz not null default now(), hits integer not null default 1
);
create table if not exists public.birdshop_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, entity_id uuid, details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.birdshop_email_jobs (
  id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
  kind text not null, entity_id uuid not null, payload jsonb,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','attention')),
  attempts integer not null default 0, first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
  lease_id uuid, lease_until timestamptz, provider_id text, sent_at timestamptz, last_error text,
  created_at timestamptz not null default now()
);
create index if not exists birdshop_email_jobs_due on public.birdshop_email_jobs(next_attempt_at) where status in ('queued','failed','sending');
create table if not exists public.birdshop_stripe_events (
  id text primary key, type text not null, payload jsonb not null,
  processed_at timestamptz, last_error text, attempts integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.birdshop_checkout_attempts (
  id uuid primary key default gen_random_uuid(), kind text not null default 'service' check (kind='service'),
  payment_request_id uuid references public.service_payment_requests(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  status text not null default 'creating' check (status in ('creating','open','processing','paid','expired','cancelled','failed','attention')),
  expected_cents bigint not null check (expected_cents >= 50), currency text not null default 'usd' check(currency='usd'),
  customer_name text, customer_email text, stripe_params jsonb,
  attempt_number integer not null default 1 check(attempt_number>0),
  idempotency_key text generated always as ('birdshop-attempt-'||id::text) stored unique,
  stripe_customer_id text, stripe_payment_status text, failure_reason text,
  completed_at timestamptz,failed_at timestamptz,expired_at timestamptz,cancelled_at timestamptz,
  last_checked_at timestamptz,cancel_requested_by uuid,
  unique(payment_request_id,attempt_number),
  stripe_session_id text unique, stripe_url text, payment_intent_id text unique,
  next_check_at timestamptz not null default now(), cancel_requested_at timestamptz, created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '1 hour'),
  check (payment_request_id is not null)
);
create unique index if not exists birdshop_one_checkout_attempt on public.birdshop_checkout_attempts(payment_request_id)
  where status in ('creating','open','processing','attention');

-- New tables are server-only; owner diagnostics will use an authorized server surface.
do $$ declare t text; begin
  foreach t in array array['birdshop_rate_limits','birdshop_audit_log','birdshop_email_jobs','birdshop_stripe_events','birdshop_checkout_attempts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant usage, select on sequence public.birdshop_audit_log_id_seq to service_role;

create or replace function private.birdshop_require_server() returns void language plpgsql set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server authorization required.'; end if;
end $$;
revoke all on function private.birdshop_require_server() from public, anon, authenticated;
grant execute on function private.birdshop_require_server() to service_role;

create or replace function public.birdshop_rate_limit(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_hits integer; begin
  perform private.birdshop_require_server();
  if p_key is null or length(p_key)<>64 or p_limit<1 or p_seconds<1 or p_seconds>86400 then raise exception 'Invalid limiter.'; end if;
  insert into public.birdshop_rate_limits as r(key) values(p_key)
  on conflict(key) do update set
    window_start=case when r.window_start < now()-make_interval(secs=>p_seconds) then now() else r.window_start end,
    hits=case when r.window_start < now()-make_interval(secs=>p_seconds) then 1 else least(r.hits+1,p_limit+1) end
  returning hits into v_hits;
  return v_hits<=p_limit;
end $$;

create or replace function public.birdshop_v2_claim_email(p_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.birdshop_email_jobs%rowtype; begin
  perform private.birdshop_require_server();
  -- Stop ambiguous retries BEFORE the email provider's 24-hour idempotency window ends.
  update public.birdshop_email_jobs set status='attention',last_error='Check provider delivery before any manual resend.'
   where status in ('queued','failed','sending') and first_attempt_at < now()-interval '23 hours'
    and (lease_until is null or lease_until<now());
  select * into j from public.birdshop_email_jobs
   where status in ('queued','failed','sending') and next_attempt_at<=now()
    and (lease_until is null or lease_until<now()) and (p_job_id is null or id=p_job_id)
   order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.birdshop_email_jobs set status='sending',attempts=attempts+1,
   first_attempt_at=coalesce(first_attempt_at,now()),lease_id=gen_random_uuid(),lease_until=now()+interval '10 minutes'
   where id=j.id returning * into j;
  return to_jsonb(j);
end $$;

create or replace function private.birdshop_queue_conversation_email() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if new.source <> 'admin_test' and new.customer_email is not null then
    insert into public.birdshop_email_jobs(dedupe_key,kind,entity_id)
      values ('conversation/customer/'||new.id,'conversation_customer',new.id),
             ('conversation/admin/'||new.id,'conversation_admin',new.id) on conflict(dedupe_key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists "birdshop-conversation-created-email" on public.service_conversations;
drop trigger if exists birdshop_v2_conversation_email on public.service_conversations;
create trigger birdshop_v2_conversation_email after insert on public.service_conversations for each row execute function private.birdshop_queue_conversation_email();

-- Fail atomically with a clear message rather than converting an existing non-USD checkout.
do $$ begin
 if exists(select 1 from public.service_payment_requests where stripe_checkout_session_id is not null
   and (lower(currency) is distinct from 'usd' or amount::text in ('NaN','Infinity','-Infinity') or amount<0.50)) then
  raise exception 'Existing checkout has an unsupported currency or amount. Review it before applying this update.';
 end if;
end $$;
do $$ begin
 if exists(select 1 from public.service_payment_requests where stripe_payment_intent_id is not null and stripe_payment_intent is not null and stripe_payment_intent_id<>stripe_payment_intent) then
  raise exception 'Conflicting historical PaymentIntent fields require review.';
 end if;
end $$;
update public.service_payment_requests set stripe_payment_intent_id=coalesce(stripe_payment_intent_id,stripe_payment_intent),stripe_payment_intent=coalesce(stripe_payment_intent,stripe_payment_intent_id)
 where stripe_payment_intent_id is distinct from stripe_payment_intent;

-- Track sessions already issued by the previous deployment, without recreating them.
insert into public.birdshop_checkout_attempts(kind,payment_request_id,order_id,status,expected_cents,currency,customer_name,customer_email,stripe_session_id,payment_intent_id,cancel_requested_at)
select 'service',p.id,p.order_id,
 case when p.status='paid' then 'paid' when p.status='processing' then 'processing' else 'open' end,
 round(p.amount*100)::bigint,lower(p.currency),c.customer_name,c.customer_email,p.stripe_checkout_session_id,p.stripe_payment_intent_id,case when p.status='cancelled' then coalesce(p.cancelled_at,now()) end
from public.service_payment_requests p join public.service_conversations c on c.id=p.conversation_id
where p.stripe_checkout_session_id is not null
on conflict(stripe_session_id) do nothing;

create or replace function public.birdshop_v2_begin_service_checkout(p_request_id uuid,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.service_conversations%rowtype; p public.service_payment_requests%rowtype; a public.birdshop_checkout_attempts%rowtype;
begin
  perform private.birdshop_require_server();
  select * into c from public.service_conversations where public_token=p_token and deleted_at is null for update;
  if not found or c.status<>'open' or c.conversation_type<>'service' or c.order_id is not null then raise exception 'This conversation cannot start a payment.'; end if;
  select * into p from public.service_payment_requests where id=p_request_id and conversation_id=c.id for update;
  if not found or p.status not in ('pending','processing') or p.paid_at is not null or p.order_id is not null then raise exception 'This payment request is no longer available.'; end if;
  select * into a from public.birdshop_checkout_attempts where payment_request_id=p.id and status in ('creating','open','processing','attention') order by created_at desc limit 1 for update;
  if found then
    if a.cancel_requested_at is not null then raise exception 'Cancellation is being confirmed. Please wait.'; end if;
  else
    if lower(p.currency) <> 'usd' or p.amount::text in ('NaN','Infinity','-Infinity') or p.amount>999999.99 then raise exception 'Invalid payment amount or currency.'; end if;
    insert into public.birdshop_checkout_attempts(kind,payment_request_id,attempt_number,expected_cents,customer_name,customer_email)
     values('service',p.id,(select coalesce(max(attempt_number),0)+1 from public.birdshop_checkout_attempts where payment_request_id=p.id),round(p.amount*100)::bigint,c.customer_name,c.customer_email) returning * into a;
  end if;
  return to_jsonb(a)||jsonb_build_object('conversation_id',c.id,'reference',c.reference,'title',p.title,'description',p.description,'public_token',c.public_token);
end $$;

create or replace function public.birdshop_v2_bind_checkout(p_attempt_id uuid,p_session_id text,p_url text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.birdshop_checkout_attempts%rowtype; v_conversation uuid;
begin
  perform private.birdshop_require_server();
  select p.conversation_id into v_conversation from public.birdshop_checkout_attempts x join public.service_payment_requests p on p.id=x.payment_request_id where x.id=p_attempt_id;
  if v_conversation is not null then
    perform 1 from public.service_conversations where id=v_conversation for update;
    perform 1 from public.service_payment_requests where id=(select payment_request_id from public.birdshop_checkout_attempts where id=p_attempt_id) for update;
  end if;
  select * into a from public.birdshop_checkout_attempts where id=p_attempt_id for update;
  if not found or nullif(p_session_id,'') is null then raise exception 'Checkout attempt missing.'; end if;
  if a.stripe_session_id is not null and a.stripe_session_id<>p_session_id then raise exception 'Checkout session mismatch.'; end if;
  if a.status not in ('creating','open','processing','paid','attention') then raise exception 'Checkout is not active.'; end if;
  update public.birdshop_checkout_attempts set stripe_session_id=p_session_id,stripe_url=coalesce(p_url,stripe_url),status=case when status in ('creating','attention') then 'open' else status end where id=a.id;
  if a.kind='service' and a.status<>'paid' then
    update public.service_payment_requests set stripe_checkout_session_id=p_session_id,stripe_checkout_url=p_url,checkout_created_at=coalesce(checkout_created_at,now()) where id=a.payment_request_id;
  end if;
end $$;

create or replace function public.birdshop_v2_begin_cancel(p_request_id uuid,p_conversation_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.service_conversations%rowtype; p public.service_payment_requests%rowtype; a public.birdshop_checkout_attempts%rowtype; v_role text;
begin
  perform private.birdshop_require_server();
  select * into c from public.service_conversations where id=p_conversation_id for update;
  select role into v_role from public.admin_users where user_id=p_actor_id and is_active;
  if c.id is null or coalesce(v_role,'') not in ('owner','service_agent') or (v_role='service_agent' and (c.conversation_type<>'service' or c.assigned_staff_user_id is distinct from p_actor_id)) then raise exception 'Not authorized.'; end if;
  perform set_config('birdshop.actor_id',p_actor_id::text,true);
  select * into p from public.service_payment_requests where id=p_request_id and conversation_id=c.id for update;
  if not found or p.order_id is not null or p.paid_at is not null or p.status='paid' then raise exception 'Payment already completed or unavailable.'; end if;
  select * into a from public.birdshop_checkout_attempts where payment_request_id=p.id and status in ('creating','open','processing','attention') order by created_at desc limit 1 for update;
  if found then
    if a.stripe_session_id is null then raise exception 'Checkout is still being created. Retry after it is reconciled.'; end if;
    update public.birdshop_checkout_attempts set cancel_requested_at=coalesce(cancel_requested_at,now()),cancel_requested_by=coalesce(cancel_requested_by,p_actor_id) where id=a.id;
    return to_jsonb(a);
  end if;
  if p.stripe_checkout_session_id is not null and not exists(select 1 from public.birdshop_checkout_attempts where payment_request_id=p.id and stripe_session_id=p.stripe_checkout_session_id and status in ('expired','cancelled','failed')) then raise exception 'Checkout must be reconciled before cancellation.'; end if;
  if p.status<>'cancelled' then
    update public.service_payment_requests set status='cancelled',cancelled_at=now() where id=p.id;
    update public.service_conversations set workflow_status=coalesce(p.previous_workflow_status,'discussing') where id=c.id and order_id is null;
    insert into public.service_messages(conversation_id,sender_type,sender_label,body,message_type) values(c.id,'system','BirdShop','Payment request cancelled. Your conversation remains available.','system');
  end if;
  return null;
end $$;

-- The old browser-callable cancel functions must not bypass Stripe expiration.
revoke execute on function public.birdshop_admin_cancel_payment_request(uuid) from public,anon,authenticated;
revoke execute on function public.birdshop_staff_cancel_payment_request(uuid) from public,anon,authenticated;

create or replace function public.birdshop_finalize_service_payment(p_payment_request_id uuid,p_checkout_session_id text,p_payment_intent_id text,p_stripe_customer_id text,p_amount_total bigint,p_currency text,p_customer_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.service_payment_requests%rowtype; c public.service_conversations%rowtype; a public.birdshop_checkout_attempts%rowtype; v_order uuid; v_reference text;
begin
  perform private.birdshop_require_server();
  select c0.* into c from public.service_conversations c0 join public.service_payment_requests p0 on p0.conversation_id=c0.id where p0.id=p_payment_request_id for update of c0;
  if not found or c.conversation_type<>'service' then raise exception 'Service conversation missing.'; end if;
  select * into p from public.service_payment_requests where id=p_payment_request_id for update;
  select * into a from public.birdshop_checkout_attempts where payment_request_id=p.id and stripe_session_id=p_checkout_session_id for update;
  if not found or p_amount_total is distinct from round(p.amount*100)::bigint or p_amount_total is distinct from a.expected_cents or lower(p_currency) is distinct from lower(p.currency) or nullif(p_payment_intent_id,'') is null then raise exception 'Payment amount, currency or checkout binding does not match.'; end if;
  -- Validate bindings even for a duplicate event.
  if p.order_id is not null then
    if p.stripe_payment_intent_id is distinct from p_payment_intent_id or a.order_id is distinct from p.order_id then raise exception 'Payment identity mismatch.'; end if;
    return p.order_id;
  end if;
  if c.order_id is not null then raise exception 'Conversation already has another order. Reconcile this payment.'; end if;
  if a.payment_intent_id is not null and a.payment_intent_id<>p_payment_intent_id then raise exception 'PaymentIntent mismatch.'; end if;
  v_reference:=c.reference;
  if exists(select 1 from public.orders where reference=v_reference) then v_reference:=null; end if;
  insert into public.orders(reference,customer_name,customer_email,customer_contact,order_type,order_status,payment_status,fulfillment_status,currency,subtotal,total,discount_total,tax_total,payment_provider,payment_reference,source,paid_at,service_slug,service_name,package_id,package_name,package_price,service_status,assigned_to,service_request_message,service_contact_handle)
   values(v_reference,coalesce(c.customer_name,'Customer'),coalesce(c.customer_email,p_customer_email),c.customer_contact,'service','active','paid','unfulfilled',upper(p.currency),p.amount,p.amount,0,0,'stripe',p_payment_intent_id,'service_chat',now(),c.service_slug,coalesce(c.service_name,p.title),c.package_id,coalesce(c.package_name,'Custom'),p.amount,'new',c.assigned_to,c.request_message,c.customer_contact) returning id into v_order;
  update public.service_payment_requests set order_id=v_order,status='paid',stripe_checkout_session_id=p_checkout_session_id,stripe_payment_intent_id=p_payment_intent_id,stripe_payment_intent=p_payment_intent_id,stripe_customer_id=p_stripe_customer_id,stripe_payment_status='paid',paid_at=coalesce(paid_at,now()),cancelled_at=null where id=p.id;
  update public.birdshop_checkout_attempts set status='paid',order_id=v_order,payment_intent_id=p_payment_intent_id where id=a.id;
  update public.service_conversations set order_id=v_order,linked_order_at=now(),workflow_status='paid',status='open',deleted_at=null,deleted_by=null where id=c.id;
  insert into public.service_messages(conversation_id,sender_type,sender_label,body,message_type,metadata)
   values(c.id,'system','BirdShop','Payment received. Your service order is active; completion will be confirmed separately.','system',jsonb_build_object('event','payment_confirmed','payment_request_id',p.id,'order_id',v_order));
  insert into public.birdshop_email_jobs(dedupe_key,kind,entity_id) values('receipt/customer/'||v_order,'service_receipt',v_order),('receipt/admin/'||v_order,'admin_payment',v_order) on conflict(dedupe_key) do nothing;
  return v_order;
end $$;

-- Owners use the same validated quote creation as assigned staff; historical package labels remain untouched.
create or replace function public.birdshop_admin_create_payment_request(p_conversation_id uuid,p_amount numeric,p_title text,p_description text default null)
returns uuid language plpgsql security definer set search_path='' as $$ begin
  if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
  return public.birdshop_staff_create_payment_request(p_conversation_id,p_amount,p_title,p_description);
end $$;

-- Customer recovery remains compatible with the existing UI in Run 1; strengthen it in Run 2.

-- Preserve all financial history, even after refunds and soft deletion.
create or replace function private.birdshop_is_financial(o public.orders) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(o.payment_provider='stripe' or o.payment_reference is not null or o.stripe_charge_id is not null or o.refunded_amount>0
   or exists(select 1 from public.service_payment_requests p where p.order_id=o.id and (p.stripe_checkout_session_id is not null or p.stripe_payment_intent_id is not null or p.stripe_charge_id is not null))
   or (o.source<>'admin_test' and (o.paid_at is not null or o.payment_status in ('paid','partially_refunded','refunded')
     or exists(select 1 from public.order_fulfillments f join public.product_inventory i on i.id=f.product_inventory_id
       where f.order_id=o.id and (f.delivered_at is not null or i.status='sold' or i.sold_at is not null)))),false)
$$;
revoke all on function private.birdshop_is_financial(public.orders) from public,anon,authenticated;
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
      if tg_table_name='order_items' and tg_op='UPDATE' and (new.product_id is null or new.product_id=old.product_id) and (to_jsonb(new)-'product_id'-'updated_at')=(to_jsonb(old)-'product_id'-'updated_at') then return new; end if;
      if tg_table_name='order_fulfillments' and tg_op='UPDATE' and new.order_id=old.order_id and new.order_item_id=old.order_item_id and new.product_inventory_id=old.product_inventory_id and (old.delivered_at is null or new.delivered_at is not distinct from old.delivered_at) then return new; end if;
      raise exception 'Purchased items and allocated codes are retained.';
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists birdshop_v2_history on public.orders;
create trigger birdshop_v2_history before delete or update on public.orders for each row execute function private.birdshop_protect_history();
drop trigger if exists birdshop_v2_history on public.service_conversations;
create trigger birdshop_v2_history before delete on public.service_conversations for each row execute function private.birdshop_protect_history();
drop trigger if exists birdshop_v2_history on public.service_payment_requests;
create trigger birdshop_v2_history before delete on public.service_payment_requests for each row execute function private.birdshop_protect_history();
drop trigger if exists birdshop_v2_history on public.order_items;
create trigger birdshop_v2_history before delete or update on public.order_items for each row execute function private.birdshop_protect_history();
drop trigger if exists birdshop_v2_history on public.order_fulfillments;
create trigger birdshop_v2_history before delete or update on public.order_fulfillments for each row execute function private.birdshop_protect_history();

create or replace function private.birdshop_protect_sold_code() returns trigger language plpgsql security definer set search_path='' as $$ begin
  if exists(select 1 from public.order_fulfillments f join public.orders o on o.id=f.order_id where f.product_inventory_id=old.id and private.birdshop_is_financial(o)) then
    if tg_op='DELETE' then raise exception 'Purchased codes cannot be deleted.'; end if;
    if old.status='sold' then new.sold_at:=coalesce(old.sold_at,now()); end if;
    if (old.sold_at is not null and new.sold_at is distinct from old.sold_at) or new.status not in ('sold','disabled') or new.code_ciphertext<>old.code_ciphertext or new.code_hash<>old.code_hash or new.product_id<>old.product_id then raise exception 'Purchased codes cannot be resold or changed.'; end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists birdshop_v2_protect_code on public.product_inventory;
create trigger birdshop_v2_protect_code before delete or update on public.product_inventory for each row execute function private.birdshop_protect_sold_code();

-- Explicit service-only grants for new RPCs; public execution is PostgreSQL's default otherwise.
do $$ declare r record; begin
 for r in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'birdshop_v2_%' or proname='birdshop_rate_limit') loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
