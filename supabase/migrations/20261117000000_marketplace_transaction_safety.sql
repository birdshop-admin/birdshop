-- BirdShop Marketplace Phase 1b: transaction safety foundation.
-- Draft feature branch only. Apply AFTER 20261116230000_marketplace_phase1_foundation.sql.
-- This migration does NOT enable marketplace checkout, process payments, or send payouts.
begin;

alter table public.birdshop_marketplace_orders
  add column if not exists state_version integer not null default 0 check(state_version >= 0),
  add column if not exists delivered_at timestamptz,
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists payout_eligible_after timestamptz,
  add column if not exists delivery_note text check(delivery_note is null or length(delivery_note) <= 3000),
  add column if not exists payment_verified_at timestamptz,
  add column if not exists refunded_at timestamptz;

alter table public.birdshop_marketplace_disputes
  add column if not exists evidence_description text check(evidence_description is null or length(evidence_description) <= 3000);

create table if not exists public.birdshop_marketplace_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.birdshop_marketplace_orders(id) on delete restrict,
  event_key text not null unique check(length(event_key) between 12 and 180),
  previous_state text not null,
  next_state text not null,
  actor_id uuid,
  actor_role text not null check(actor_role in ('buyer','seller','owner','system')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists birdshop_marketplace_order_events_order_idx
  on public.birdshop_marketplace_order_events(order_id,created_at desc);

-- Provider evidence is inserted only by a future verified webhook adapter.
-- Browser submissions or manual "paid" switches cannot create evidence.
create table if not exists public.birdshop_marketplace_payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.birdshop_marketplace_orders(id) on delete restrict,
  provider text not null check(provider ~ '^[a-z][a-z0-9_]{2,39}$'),
  provider_event_id text not null check(length(provider_event_id) between 8 and 255),
  payment_reference text not null check(length(payment_reference) between 8 and 255),
  event_type text not null check(event_type in ('payment_succeeded','payment_refunded','chargeback_confirmed')),
  verified_amount_cents bigint not null check(verified_amount_cents>0),
  currency text not null default 'usd' check(currency='usd'),
  evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id),
  unique(order_id,event_type,provider_event_id)
);
create index if not exists birdshop_marketplace_payment_order_idx
  on public.birdshop_marketplace_payment_events(order_id,created_at desc);

-- One earning entry per completed order. No entry can be transferred twice.
-- Allocation records are not themselves proof of paid money.
create table if not exists public.birdshop_marketplace_payout_allocations (
  payout_id uuid not null references public.birdshop_marketplace_payouts(id) on delete restrict,
  ledger_id uuid not null unique references public.birdshop_marketplace_ledger(id) on delete restrict,
  amount_cents bigint not null check(amount_cents>0),
  created_at timestamptz not null default now(),
  primary key(payout_id,ledger_id)
);
alter table public.birdshop_marketplace_payouts
  add column if not exists idempotency_key text unique,
  add column if not exists paid_at timestamptz;

-- DB invariants: validate seller, stock, fee snapshot when future checkout inserts orders.
-- Financial state changes occur through server-only RPC functions; no buyer API can
-- directly modify these protected tables.
create or replace function public.birdshop_marketplace_validate_order_insert()
returns trigger language plpgsql set search_path = ''
as $validate_order$
declare v_listing public.birdshop_marketplace_listings%rowtype;
  v_rate integer; v_expected bigint;
begin
  if new.state <> 'payment_pending' or new.payment_reference is not null
     or new.payment_provider is not null or new.paid_at is not null then
    raise exception 'New seller orders must begin unpaid';
  end if;
  select * into v_listing from public.birdshop_marketplace_listings
    where id=new.listing_id;
  if not found or v_listing.seller_id <> new.seller_id
     or v_listing.status <> 'published' or v_listing.stock < new.quantity then
    raise exception 'Listing is unavailable for this seller and quantity';
  end if;
  if not exists(select 1 from public.birdshop_seller_profiles s
    where s.id=new.seller_id and s.status='active') then
    raise exception 'Seller is unavailable';
  end if;
  v_expected:=v_listing.price_cents::bigint * new.quantity;
  select commission_bps into v_rate from public.birdshop_seller_profiles
    where id=new.seller_id;
  if new.subtotal_cents<>v_expected or new.commission_bps<>v_rate or
     new.commission_cents<>floor(v_expected::numeric*v_rate/10000 + 0.5)::bigint then
    raise exception 'Incorrect item price or seller fee snapshot';
  end if;
  if new.buyer_user_id=(select user_id from public.birdshop_seller_profiles
      where id=new.seller_id) then
    raise exception 'Seller cannot purchase from self';
  end if;
  return new;
end $validate_order$;

drop trigger if exists birdshop_validate_marketplace_order_insert
  on public.birdshop_marketplace_orders;
create trigger birdshop_validate_marketplace_order_insert before insert
  on public.birdshop_marketplace_orders for each row
  execute function public.birdshop_marketplace_validate_order_insert();

-- Actor matching is backed by identities in database, not client-provided roles.
create or replace function public.birdshop_marketplace_actor_allowed(
  p_order_id uuid, p_actor_id uuid, p_role text
) returns boolean language sql stable set search_path = ''
as $allowed$
select case
 when p_role='buyer' then exists(
   select 1 from public.birdshop_marketplace_orders o
   where o.id=p_order_id and o.buyer_user_id=p_actor_id)
 when p_role='seller' then exists(
   select 1 from public.birdshop_marketplace_orders o
   join public.birdshop_seller_profiles s on s.id=o.seller_id
   where o.id=p_order_id and s.user_id=p_actor_id and s.status='active')
 when p_role='owner' then exists(
   select 1 from public.admin_users a
   where a.user_id=p_actor_id and a.is_active and a.role='owner')
 when p_role='system' then p_actor_id is null
 else false end
$allowed$;

-- Allow only explicitly enumerated state transitions, atomically guarded by FOR UPDATE.
-- "Paid"/"Refunded" REQUIRE verified provider evidence for THIS order.
-- No payment webhook writes evidence until a provider is selected and approved.
create or replace function public.birdshop_marketplace_transition_order(
  p_order_id uuid,
  p_expected_state text,
  p_next_state text,
  p_actor_id uuid,
  p_actor_role text,
  p_event_key text,
  p_note text default ''
) returns text language plpgsql security definer set search_path = ''
as $order_transition$
declare
  v_order public.birdshop_marketplace_orders%rowtype;
  v_event public.birdshop_marketplace_order_events%rowtype;
  v_seller_net bigint;
  v_verified public.birdshop_marketplace_payment_events%rowtype;
begin
  perform private.birdshop_require_server();
  if p_order_id is null or p_expected_state is null or p_next_state is null or
     p_actor_role not in ('buyer','seller','owner','system') or
     p_event_key is null or p_event_key !~ '^[a-zA-Z0-9:._-]{12,180}$' or
     p_note is null or length(p_note)>3000 then
    raise exception 'Invalid state transition request';
  end if;

  select * into v_order from public.birdshop_marketplace_orders
    where id=p_order_id for update;
  if not found then raise exception 'Marketplace order not found'; end if;

  select * into v_event from public.birdshop_marketplace_order_events
    where event_key=p_event_key;
  if found then
    if v_event.order_id=p_order_id and v_event.previous_state=p_expected_state and
       v_event.next_state=p_next_state and v_event.actor_role=p_actor_role and
       v_event.actor_id is not distinct from p_actor_id then
      return v_event.next_state;
    end if;
    raise exception 'Event key already used by another transition';
  end if;

  if v_order.state<>p_expected_state then
    raise exception 'Order state changed; refresh before retrying';
  end if;
  if not public.birdshop_marketplace_actor_allowed(p_order_id,p_actor_id,p_actor_role) then
    raise exception 'Unauthorized order actor';
  end if;

  if p_next_state='paid' then
    if p_actor_role<>'system' or v_order.state<>'payment_pending' then
      raise exception 'Payment must be confirmed by provider evidence';
    end if;
    select * into v_verified from public.birdshop_marketplace_payment_events e
      where e.order_id=p_order_id and e.event_type='payment_succeeded'
        and e.verified_amount_cents=v_order.subtotal_cents
        and e.currency=v_order.currency
        and ('provider:'||e.provider||':'||e.provider_event_id)=p_event_key
      limit 1;
    if not found then raise exception 'Verified payment evidence is missing'; end if;
    update public.birdshop_marketplace_orders set
      payment_provider=v_verified.provider, payment_reference=v_verified.payment_reference,
      payment_verified_at=now(),paid_at=now()
      where id=p_order_id;
  elsif p_next_state='refunded' then
    if p_actor_role<>'system' or v_order.state not in
       ('paid','fulfillment_pending','delivered','buyer_confirmed','completed','disputed') then
      raise exception 'Refund must be confirmed by payment provider';
    end if;
    select * into v_verified from public.birdshop_marketplace_payment_events e
      where e.order_id=p_order_id and e.event_type in
        ('payment_refunded','chargeback_confirmed')
        and e.verified_amount_cents=v_order.subtotal_cents
        and e.currency=v_order.currency
        and ('provider:'||e.provider||':'||e.provider_event_id)=p_event_key
      limit 1;
    if not found then raise exception 'Verified refund evidence is missing'; end if;
    update public.birdshop_marketplace_orders set refunded_at=now()
      where id=p_order_id;
    -- Revoke future availability and record an offsetting entry (if earned).
    update public.birdshop_marketplace_ledger set status='void'
      where order_id=p_order_id and entry_type='earned'
        and status in ('pending','available');
    select coalesce(sum(amount_cents),0) into v_seller_net
      from public.birdshop_marketplace_ledger
      where order_id=p_order_id and entry_type='earned';
    if v_seller_net>0 then
      insert into public.birdshop_marketplace_ledger(
        seller_id,order_id,event_key,entry_type,amount_cents,status
      ) values (
        v_order.seller_id,p_order_id,'order:'||p_order_id||':reversal',
        case when v_verified.event_type='chargeback_confirmed'
          then 'chargeback' else 'refund' end,
        -v_seller_net,'settled'
      ) on conflict(event_key) do nothing;
    end if;
  elsif p_next_state='fulfillment_pending' then
    if v_order.state<>'paid' or p_actor_role<>'seller' then
      raise exception 'Only an approved seller can start paid fulfillment';
    end if;
  elsif p_next_state='delivered' then
    if v_order.state<>'fulfillment_pending' or p_actor_role<>'seller' or length(trim(p_note))<5 then
      raise exception 'Seller must provide a delivery note';
    end if;
    update public.birdshop_marketplace_orders set
      delivered_at=now(),delivery_note=p_note where id=p_order_id;
  elsif p_next_state='buyer_confirmed' then
    if v_order.state<>'delivered' or p_actor_role<>'buyer' then
      raise exception 'Only the buyer can confirm receipt';
    end if;
    update public.birdshop_marketplace_orders set buyer_confirmed_at=now()
      where id=p_order_id;
  elsif p_next_state='completed' then
    if v_order.state<>'buyer_confirmed' or p_actor_role<>'owner' then
      raise exception 'Owner review is required for seller order completion';
    end if;
    if exists(select 1 from public.birdshop_marketplace_disputes
      where order_id=p_order_id and status in ('open','under_review')) then
      raise exception 'Cannot complete a disputed order';
    end if;
    v_seller_net:=v_order.subtotal_cents-v_order.commission_cents;
    insert into public.birdshop_marketplace_ledger(
      seller_id,order_id,event_key,entry_type,amount_cents,status
    ) values (
      v_order.seller_id,p_order_id,'order:'||p_order_id||':earned',
      'earned',v_seller_net,'pending'
    ) on conflict(event_key) do nothing;
    update public.birdshop_marketplace_orders set
      completed_at=now(),payout_eligible_after=now()+interval '7 days'
      where id=p_order_id;
  elsif p_next_state='cancelled' then
    if v_order.state<>'payment_pending' or
       p_actor_role not in ('buyer','owner') then
      raise exception 'Only unpaid orders can be cancelled';
    end if;
  else
    raise exception 'Unsupported order transition; use the dispute workflow';
  end if;

  update public.birdshop_marketplace_orders set
    state=p_next_state,state_version=state_version+1,updated_at=now()
    where id=p_order_id;
  insert into public.birdshop_marketplace_order_events(
    order_id,event_key,previous_state,next_state,actor_id,actor_role,note
  ) values (
    p_order_id,p_event_key,p_expected_state,p_next_state,
    p_actor_id,p_actor_role,nullif(trim(p_note),'')
  );
  return p_next_state;
end $order_transition$;

-- A buyer can open a dispute; owner can then investigate.
-- A disputed order is blocked from payout release.
create or replace function public.birdshop_marketplace_open_dispute(
  p_order_id uuid,p_buyer_id uuid,p_reason text,p_event_key text
) returns uuid language plpgsql security definer set search_path = ''
as $open_dispute$
declare v_order public.birdshop_marketplace_orders%rowtype;
  v_dispute uuid;
begin
  perform private.birdshop_require_server();
  if p_reason is null or length(trim(p_reason)) not between 10 and 3000 or
     p_event_key is null or p_event_key !~ '^[a-zA-Z0-9:._-]{12,180}$' then
    raise exception 'Invalid dispute details';
  end if;
  select * into v_order from public.birdshop_marketplace_orders
    where id=p_order_id for update;
  if not found or v_order.buyer_user_id<>p_buyer_id then
    raise exception 'Order does not belong to buyer';
  end if;
  if v_order.state not in ('paid','fulfillment_pending','delivered','buyer_confirmed','completed') then
    raise exception 'Order cannot be disputed in its current state';
  end if;
  if exists(select 1 from public.birdshop_marketplace_disputes where order_id=p_order_id) then
    raise exception 'A dispute has already been filed for this order';
  end if;
  insert into public.birdshop_marketplace_disputes(
    order_id,buyer_user_id,seller_id,reason,status
  ) values (
    p_order_id,p_buyer_id,v_order.seller_id,p_reason,'open'
  ) returning id into v_dispute;
  update public.birdshop_marketplace_orders set
    state='disputed',state_version=state_version+1,updated_at=now()
    where id=p_order_id;
  insert into public.birdshop_marketplace_order_events(
    order_id,event_key,previous_state,next_state,actor_id,actor_role,note
  ) values (
    p_order_id,p_event_key,v_order.state,'disputed',p_buyer_id,'buyer',p_reason
  );
  return v_dispute;
end $open_dispute$;

-- Releasing earnings is an owner-only ledger action, not a payout.
-- Must be past the hold date and the seller/order must be good-standing.
create or replace function public.birdshop_marketplace_release_earnings(
  p_order_id uuid,p_owner_id uuid
) returns bigint language plpgsql security definer set search_path = ''
as $release_earnings$
declare v_order public.birdshop_marketplace_orders%rowtype;
  v_entry public.birdshop_marketplace_ledger%rowtype;
begin
  perform private.birdshop_require_server();
  if not exists(select 1 from public.admin_users
    where user_id=p_owner_id and is_active and role='owner') then
    raise exception 'Owner approval required';
  end if;
  select * into v_order from public.birdshop_marketplace_orders
    where id=p_order_id for update;
  if not found or v_order.state<>'completed' or
     v_order.payout_eligible_after is null or v_order.payout_eligible_after>now() then
    raise exception 'Order payout hold is not complete';
  end if;
  if exists(select 1 from public.birdshop_marketplace_disputes
      where order_id=p_order_id and status in ('open','under_review')) or
     not exists(select 1 from public.birdshop_seller_profiles
       where id=v_order.seller_id and status='active') then
    raise exception 'Order or seller is on hold';
  end if;
  select * into v_entry from public.birdshop_marketplace_ledger
    where order_id=p_order_id and entry_type='earned' for update;
  if not found then raise exception 'No eligible ledger entry'; end if;
  if v_entry.status='available' then return v_entry.amount_cents; end if;
  if v_entry.status<>'pending' then
    raise exception 'Ledger entry cannot be released';
  end if;
  update public.birdshop_marketplace_ledger set status='available'
    where id=v_entry.id;
  insert into public.birdshop_marketplace_audit(
    entity_type,entity_id,actor_id,action,details
  ) values ('marketplace_order',p_order_id,p_owner_id,'earnings_released',
    jsonb_build_object('amount_cents',v_entry.amount_cents));
  return v_entry.amount_cents;
end $release_earnings$;

-- Lock down both new tables and function EXECUTE to service role only.
do $secure_tables$
declare t text;
begin
  foreach t in array array[
    'birdshop_marketplace_order_events',
    'birdshop_marketplace_payment_events',
    'birdshop_marketplace_payout_allocations'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
  end loop;
end $secure_tables$;
grant usage,select on sequence public.birdshop_marketplace_order_events_id_seq
  to service_role;

revoke all on function public.birdshop_marketplace_actor_allowed(uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.birdshop_marketplace_transition_order(uuid,text,text,uuid,text,text,text)
  from public,anon,authenticated;
revoke all on function public.birdshop_marketplace_open_dispute(uuid,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.birdshop_marketplace_release_earnings(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.birdshop_marketplace_actor_allowed(uuid,uuid,text) to service_role;
grant execute on function public.birdshop_marketplace_transition_order(uuid,text,text,uuid,text,text,text) to service_role;
grant execute on function public.birdshop_marketplace_open_dispute(uuid,uuid,text,text) to service_role;
grant execute on function public.birdshop_marketplace_release_earnings(uuid,uuid) to service_role;

-- No payouts, payment webhooks, or marketplace checkout routes are enabled by this migration.
comment on table public.birdshop_marketplace_payment_events is
  'Provider evidence table reserved for an authenticated, signature-verified future payment adapter. No adapter is active.';
commit;