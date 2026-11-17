-- Additive, review-only. USD qualification. No hosted database changes on push.
begin;

alter table public.birdshop_seller_profiles
  alter column commission_bps set default 800,
  add column earned_tier text not null default 'starter'
    check(earned_tier in ('starter','bronze','silver','gold')),
  add column partner_approved boolean not null default false,
  add column commission_override_bps integer check(commission_override_bps between 0 and 5000),
  add column qualifying_sales_cents bigint not null default 0 check(qualifying_sales_cents >= 0);
-- Preserve explicitly configured legacy rates; 10% was the provisional default.
update public.birdshop_seller_profiles s set commission_override_bps=case
  when s.commission_bps<>1000 or exists(select 1 from public.birdshop_marketplace_audit a
    where a.entity_type='seller' and a.entity_id=s.id and a.action='commission_updated')
  then s.commission_bps end;
update public.birdshop_seller_profiles set commission_bps=coalesce(commission_override_bps,800);

create table public.birdshop_seller_connect_accounts (
  seller_id uuid primary key references public.birdshop_seller_profiles(id),
  stripe_account_id text unique check(stripe_account_id ~ '^acct_[a-zA-Z0-9]+$'),
  country text not null check(country ~ '^[A-Z]{2}$'),
  creation_key uuid not null unique default gen_random_uuid(),
  creation_payload jsonb not null,
  creation_started_at timestamptz not null default now(),
  transfers_status text not null default 'pending',
  requirements jsonb not null default '[]',
  future_requirements jsonb not null default '[]',
  closed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.birdshop_marketplace_orders
  add column refunded_cents bigint not null default 0 check(refunded_cents between 0 and subtotal_cents),
  add column fraudulent boolean not null default false,
  add column stripe_dispute_status text,
  add column stripe_charge_id text unique,
  add column stripe_checkout_session_id text unique,
  add column stripe_destination text,
  add column stripe_reconciled_at timestamptz,
  add column checkout_key uuid unique,
  add column checkout_expires_at timestamptz,
  add column inventory_reserved boolean not null default false,
  add column listing_title text;
create index birdshop_marketplace_orders_qualifying on public.birdshop_marketplace_orders(seller_id)
  where completed_at is not null and payment_verified_at is not null;

create table public.birdshop_marketplace_stripe_receipts (
  event_id text primary key,
  order_id uuid not null references public.birdshop_marketplace_orders(id),
  charge_id text not null,
  refunded_cents bigint not null,
  fraudulent boolean not null,
  dispute_status text,
  observed_at timestamptz not null default now()
);

create or replace function public.birdshop_review_seller_application(
  p_id uuid, p_action text, p_owner uuid, p_note text default ''
) returns void language plpgsql security definer set search_path = ''
as $seller_review$
declare v_app public.birdshop_seller_applications%rowtype;
begin
  perform private.birdshop_require_server();
  if not exists(select 1 from public.admin_users where user_id=p_owner and is_active and role='owner') then raise exception 'Owner approval required'; end if;
  if p_owner is null or p_action not in ('approved','rejected') or
     p_note is null or length(p_note)>1000 then
    raise exception 'Invalid seller review request';
  end if;
  select * into v_app from public.birdshop_seller_applications
    where id=p_id for update;
  if not found or v_app.status <> 'pending' then
    raise exception 'Application is no longer pending';
  end if;
  if p_action='approved' then
    insert into public.birdshop_seller_profiles(
      application_id,user_id,handle,display_name,description,status,commission_bps
    ) values (
      v_app.id,v_app.user_id,v_app.requested_handle,
      v_app.business_name,v_app.description,'active',800
    );
  end if;
  update public.birdshop_seller_applications
    set status=p_action,review_note=nullif(trim(p_note),''),
      reviewed_at=now(),reviewed_by=p_owner,updated_at=now()
    where id=p_id;
  insert into public.birdshop_marketplace_audit(
    entity_type,entity_id,actor_id,action,details
  ) values (
    'seller_application',p_id,p_owner,p_action,
    jsonb_build_object('handle',v_app.requested_handle)
  );
end $seller_review$;

-- One durable creation request per seller; immutable inputs survive network failure.
create or replace function public.birdshop_prepare_connect(p_seller uuid,p_user uuid,p_country text,p_email text)
returns public.birdshop_seller_connect_accounts
language plpgsql security definer set search_path='' as $$
declare s public.birdshop_seller_profiles%rowtype; c public.birdshop_seller_connect_accounts%rowtype;
begin
  perform private.birdshop_require_server();
  select * into s from public.birdshop_seller_profiles where id=p_seller for update;
  if not found or s.user_id<>p_user or s.status<>'active' then raise exception 'Approved seller ownership required'; end if;
  if p_country is null or p_country !~ '^[A-Z]{2}$' or p_email is null then raise exception 'Actual seller country and verified email required'; end if;
  insert into public.birdshop_seller_connect_accounts(seller_id,country,creation_payload)
    values(p_seller,p_country,jsonb_build_object('display_name',s.display_name,'contact_email',p_email))
    on conflict(seller_id) do nothing;
  select * into c from public.birdshop_seller_connect_accounts where seller_id=p_seller;
  if c.country<>p_country then raise exception 'Country is immutable after Connect creation starts'; end if;
  return c;
end $$;

create or replace function public.birdshop_seller_effective_fee()
returns trigger language plpgsql set search_path='' as $$
begin
  new.commission_bps:=coalesce(new.commission_override_bps,case
    when new.partner_approved then 400 when new.earned_tier='gold' then 500
    when new.earned_tier='silver' then 600 when new.earned_tier='bronze' then 700 else 800 end);
  return new;
end $$;
create trigger birdshop_seller_effective_fee before insert or update on public.birdshop_seller_profiles
  for each row execute function public.birdshop_seller_effective_fee();

create or replace function public.birdshop_refresh_seller_tier(p_seller uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s public.birdshop_seller_profiles%rowtype; volume bigint; tier text;
begin
  perform private.birdshop_require_server();
  select * into s from public.birdshop_seller_profiles where id=p_seller for update;
  if not found then raise exception 'Seller not found'; end if;
  select coalesce(sum(subtotal_cents-refunded_cents),0) into volume
    from public.birdshop_marketplace_orders where seller_id=p_seller
      and state='completed' and completed_at is not null and payment_verified_at is not null
      and paid_at is not null and not fraudulent and refunded_cents<subtotal_cents
      and coalesce(stripe_dispute_status,'') in ('','won','warning_closed')
      and not exists(select 1 from public.birdshop_marketplace_disputes d
        where d.order_id=birdshop_marketplace_orders.id and d.status in ('open','under_review','resolved_buyer'));
  tier:=case when volume>=1000000 then 'gold' when volume>=250000 then 'silver'
    when volume>=50000 then 'bronze' else 'starter' end;
  -- Keep earned tiers even after refunds or disputes reduce current volume.
  if array_position(array['starter','bronze','silver','gold'],tier)<
     array_position(array['starter','bronze','silver','gold'],s.earned_tier) then tier:=s.earned_tier; end if;
  update public.birdshop_seller_profiles set earned_tier=tier,qualifying_sales_cents=volume where id=p_seller;
  if tier<>s.earned_tier then
    insert into public.birdshop_marketplace_audit(entity_type,entity_id,action,details)
      values('seller',p_seller,'tier_earned',jsonb_build_object('tier',tier,'qualifying_sales_cents',volume));
  end if;
end $$;
create or replace function public.birdshop_order_refresh_tier()
returns trigger language plpgsql set search_path='' as $$
begin perform public.birdshop_refresh_seller_tier(new.seller_id); return new; end $$;
create trigger birdshop_order_refresh_tier after insert or update of state,completed_at,
  payment_verified_at,paid_at,refunded_cents,fraudulent,stripe_dispute_status
  on public.birdshop_marketplace_orders for each row execute function public.birdshop_order_refresh_tier();
create trigger birdshop_dispute_refresh_tier after insert or update of status on public.birdshop_marketplace_disputes
  for each row execute function public.birdshop_order_refresh_tier();

create or replace function public.birdshop_owner_seller_pricing(p_owner uuid,p_seller uuid,p_partner boolean,p_override integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.birdshop_require_server();
  if not exists(select 1 from public.admin_users where user_id=p_owner and is_active and role='owner')
    then raise exception 'Owner approval required'; end if;
  if p_partner is null or (p_override is not null and p_override not between 0 and 5000) then raise exception 'Invalid pricing'; end if;
  update public.birdshop_seller_profiles set partner_approved=p_partner,commission_override_bps=p_override where id=p_seller;
  if not found then raise exception 'Approved seller not found'; end if;
  insert into public.birdshop_marketplace_audit(entity_type,entity_id,actor_id,action,details)
    values('seller',p_seller,p_owner,'pricing_override',jsonb_build_object('partner',p_partner,'override_bps',p_override));
end $$;

-- Reserve inventory and snapshot price/fees atomically. Browser supplies only listing, quantity, request key.
create or replace function public.birdshop_reserve_marketplace_checkout(p_buyer uuid,p_listing uuid,p_quantity integer,p_key uuid)
returns public.birdshop_marketplace_orders
language plpgsql security definer set search_path='' as $$
declare l public.birdshop_marketplace_listings%rowtype; s public.birdshop_seller_profiles%rowtype;
  c public.birdshop_seller_connect_accounts%rowtype; o public.birdshop_marketplace_orders%rowtype; total bigint;
begin
  perform private.birdshop_require_server();
  if p_buyer is null or p_key is null or p_quantity is null or p_quantity not between 1 and 10 then raise exception 'Invalid checkout'; end if;
  -- Serialize duplicate submissions before inserting an order or reserving stock.
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select * into o from public.birdshop_marketplace_orders where checkout_key=p_key;
  if found then
    if o.buyer_user_id<>p_buyer or o.listing_id<>p_listing or o.quantity<>p_quantity then raise exception 'Checkout key already used'; end if;
    return o;
  end if;
  select * into l from public.birdshop_marketplace_listings where id=p_listing for update;
  if not found or l.status<>'published' or l.stock<p_quantity then raise exception 'Listing unavailable'; end if;
  select * into s from public.birdshop_seller_profiles where id=l.seller_id for update;
  if s.status<>'active' or s.user_id=p_buyer then raise exception 'Seller unavailable or self-purchase'; end if;
  select * into c from public.birdshop_seller_connect_accounts where seller_id=s.id;
  if not found or c.stripe_account_id is null or c.closed or c.transfers_status<>'active' then raise exception 'Seller onboarding incomplete'; end if;
  total:=l.price_cents::bigint*p_quantity;
  insert into public.birdshop_marketplace_orders(listing_id,buyer_user_id,seller_id,quantity,subtotal_cents,
    commission_bps,commission_cents,stripe_destination,checkout_key,checkout_expires_at,inventory_reserved,listing_title)
    values(l.id,p_buyer,s.id,p_quantity,total,s.commission_bps,floor(total::numeric*s.commission_bps/10000+0.5),
      c.stripe_account_id,p_key,date_trunc('second',now())+interval '31 minutes',true,l.title)
    returning * into o;
  update public.birdshop_marketplace_listings set stock=stock-p_quantity where id=l.id;
  return o;
end $$;

-- Apply a freshly retrieved, signature-triggered Stripe charge. Replays and out-of-order refunds are harmless.
create or replace function public.birdshop_apply_marketplace_charge(
  p_order uuid,p_event text,p_charge text,p_payment_intent text,p_amount bigint,p_currency text,
  p_destination text,p_fee bigint,p_refunded bigint,p_fraud boolean,p_dispute text,p_paid boolean)
returns void language plpgsql security definer set search_path='' as $$
declare o public.birdshop_marketplace_orders%rowtype; net bigint; seller uuid;
begin
  perform private.birdshop_require_server();
  select seller_id into seller from public.birdshop_marketplace_orders where id=p_order;
  perform 1 from public.birdshop_seller_profiles where id=seller for update;
  select * into o from public.birdshop_marketplace_orders where id=p_order for update;
  if not found or p_amount is distinct from o.subtotal_cents or p_currency is distinct from o.currency
    or p_destination is distinct from o.stripe_destination or p_fee is distinct from o.commission_cents
    or p_refunded is null or p_refunded not between 0 and p_amount
    or p_charge is null or p_payment_intent is null or p_fraud is null or p_paid is distinct from true
    or (o.stripe_charge_id is not null and o.stripe_charge_id<>p_charge)
    or (o.payment_reference is not null and o.payment_reference<>p_payment_intent)
    then raise exception 'Stripe payment does not match marketplace order snapshot'; end if;
  if exists(select 1 from public.birdshop_marketplace_stripe_receipts where event_id=p_event) then return; end if;
  insert into public.birdshop_marketplace_stripe_receipts(event_id,order_id,charge_id,refunded_cents,fraudulent,dispute_status)
    values(p_event,p_order,p_charge,p_refunded,p_fraud,p_dispute);
  p_refunded:=greatest(p_refunded,o.refunded_cents);
  update public.birdshop_marketplace_orders set
    payment_provider='stripe',payment_reference=p_payment_intent,stripe_charge_id=p_charge,
    paid_at=coalesce(paid_at,now()),payment_verified_at=coalesce(payment_verified_at,now()),
    refunded_cents=p_refunded,fraudulent=fraudulent or p_fraud,stripe_dispute_status=p_dispute,
    state=case when p_refunded=subtotal_cents then 'refunded' when state='payment_pending' then 'paid' else state end,
    refunded_at=case when p_refunded=subtotal_cents then coalesce(refunded_at,now()) else refunded_at end,
    state_version=state_version+1,updated_at=now() where id=p_order;
  -- Destination charges allocate funds in Stripe. The local ledger is an earnings journal,
  -- never a second source for issuing transfers. Reflect net refunds and risk holds.
  net:=o.subtotal_cents-p_refunded-
    floor((o.subtotal_cents-p_refunded)::numeric*o.commission_bps/10000+0.5)::bigint;
  update public.birdshop_marketplace_ledger set amount_cents=greatest(1,net),
    status=case when net=0 or p_fraud or o.fraudulent or coalesce(p_dispute,'') not in ('','won','warning_closed') then 'void' when status='void' then 'pending' else status end
    where order_id=p_order and entry_type='earned' and status<>'settled';
  insert into public.birdshop_marketplace_order_events(order_id,event_key,previous_state,next_state,actor_role,note)
    select p_order,'stripe:'||p_event,o.state,state,'system','Stripe-confirmed payment/refund/risk reconciliation'
    from public.birdshop_marketplace_orders where id=p_order;
end $$;

-- Expire ONLY after Stripe confirms an unpaid, expired session (or no session was ever created).
create or replace function public.birdshop_expire_marketplace_checkout(p_order uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o public.birdshop_marketplace_orders%rowtype;
begin
  perform private.birdshop_require_server();
  select * into o from public.birdshop_marketplace_orders where id=p_order for update;
  if not found or o.state<>'payment_pending' then return; end if;
  update public.birdshop_marketplace_orders set state='cancelled',inventory_reserved=false where id=p_order;
  if o.inventory_reserved then update public.birdshop_marketplace_listings set stock=stock+o.quantity where id=o.listing_id; end if;
end $$;

-- Protect fee snapshots from accidental post-payment editing, even by a future server path.
create or replace function public.birdshop_marketplace_immutable_snapshot()
returns trigger language plpgsql set search_path='' as $$
begin
  if (new.seller_id,new.buyer_user_id,new.listing_id,new.quantity,new.subtotal_cents,new.currency,
      new.commission_bps,new.commission_cents,new.stripe_destination,new.checkout_key,new.checkout_expires_at)
    is distinct from (old.seller_id,old.buyer_user_id,old.listing_id,old.quantity,old.subtotal_cents,old.currency,
      old.commission_bps,old.commission_cents,old.stripe_destination,old.checkout_key,old.checkout_expires_at)
    then raise exception 'Order financial snapshot is immutable'; end if;
  -- Extend the existing completion/release safety model for partial refunds and fraud.
  if new.state in ('fulfillment_pending','delivered','buyer_confirmed','completed') and old.state<>new.state and
    (new.fraudulent or new.refunded_cents=new.subtotal_cents or coalesce(new.stripe_dispute_status,'') not in ('','won','warning_closed'))
    then raise exception 'Order has a payment risk hold'; end if;
  return new;
end $$;
create trigger birdshop_marketplace_immutable_snapshot before update on public.birdshop_marketplace_orders
  for each row execute function public.birdshop_marketplace_immutable_snapshot();

-- Existing completion RPC posts the original snapshot; adjust new earnings for partial refunds.
create or replace function public.birdshop_marketplace_earning_net()
returns trigger language plpgsql set search_path='' as $$
declare o public.birdshop_marketplace_orders%rowtype;
begin
  if new.entry_type='earned' then
    select * into o from public.birdshop_marketplace_orders where id=new.order_id;
    new.amount_cents:=o.subtotal_cents-o.refunded_cents-floor((o.subtotal_cents-o.refunded_cents)::numeric*o.commission_bps/10000+0.5)::bigint;
    if new.amount_cents<=0 or o.fraudulent or coalesce(o.stripe_dispute_status,'') not in ('','won','warning_closed') then raise exception 'No legitimate earnings'; end if;
  end if;
  return new;
end $$;
create trigger birdshop_marketplace_earning_net before insert on public.birdshop_marketplace_ledger
  for each row execute function public.birdshop_marketplace_earning_net();

-- Existing buyer cancel would race Stripe payment; connected checkouts must be expired at Stripe first.
create or replace function public.birdshop_marketplace_guard_cancel()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.state='cancelled' and old.state='payment_pending' and old.checkout_key is not null
    and new.inventory_reserved then raise exception 'Expire the Stripe checkout before cancelling'; end if;
  return new;
end $$;
create trigger birdshop_marketplace_guard_cancel before update on public.birdshop_marketplace_orders
  for each row execute function public.birdshop_marketplace_guard_cancel();

-- The service role is the only caller. SECURITY DEFINER RPCs enforce private.birdshop_require_server().
do $$
declare t text; f record;
begin
  foreach t in array array['birdshop_seller_connect_accounts','birdshop_marketplace_stripe_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('birdshop_prepare_connect','birdshop_refresh_seller_tier',
      'birdshop_owner_seller_pricing','birdshop_reserve_marketplace_checkout','birdshop_apply_marketplace_charge',
      'birdshop_expire_marketplace_checkout') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
-- Recompute legacy qualified volume without downgrading future earned tiers.
do $$ declare s record; previous_role text; begin
  previous_role:=current_setting('request.jwt.claim.role',true);
  perform set_config('request.jwt.claim.role','service_role',true);
  for s in select id from public.birdshop_seller_profiles loop perform public.birdshop_refresh_seller_tier(s.id); end loop;
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
end $$;
commit;
