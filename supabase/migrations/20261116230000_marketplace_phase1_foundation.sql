-- BirdShop Phase 1 marketplace foundation.
-- This is a reviewed, ADDITIVE migration. Do not apply to production before approval.
-- No modifications to the existing Stripe checkout, orders, products, services or chats.
begin;

create table public.birdshop_seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  contact_email text not null check (length(contact_email) between 5 and 320),
  business_name text not null check (length(business_name) between 3 and 90),
  requested_handle text not null check (requested_handle ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  description text not null check (length(description) between 30 and 1500),
  categories text[] not null check (array_length(categories,1) between 1 and 8),
  payout_preference text not null check (payout_preference in ('bank','paypal','provider_to_be_approved')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text check (length(review_note) <= 1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index birdshop_seller_application_handle_pending
  on public.birdshop_seller_applications(requested_handle) where status = 'pending';

create table public.birdshop_seller_profiles (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.birdshop_seller_applications(id) on delete restrict,
  user_id uuid not null unique references auth.users(id) on delete restrict,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  display_name text not null check(length(display_name) between 3 and 90),
  description text not null default '' check(length(description) <= 1500),
  logo_url text check(logo_url is null or (length(logo_url) <= 1000 and logo_url ~ '^https://')),
  status text not null default 'active' check(status in ('active','suspended')),
  commission_bps integer not null default 1000 check(commission_bps between 0 and 5000),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.birdshop_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.birdshop_seller_profiles(id) on delete restrict,
  slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,119}$'),
  title text not null check(length(title) between 3 and 120),
  description text not null check(length(description) between 20 and 3000),
  listing_type text not null check(listing_type in ('digital_product','game_service')),
  category text not null check(length(category) between 2 and 60),
  image_url text check(image_url is null or (length(image_url) <= 1000 and image_url ~ '^https://')),
  price_cents integer not null check(price_cents between 50 and 99999999),
  stock integer not null default 1 check(stock between 0 and 10000),
  fulfillment_method text not null check(fulfillment_method in ('seller_manual','service_scheduled')),
  delivery_hours integer not null check(delivery_hours between 1 and 720),
  status text not null default 'draft' check(status in ('draft','pending_review','published','paused','rejected')),
  moderated_by uuid references auth.users(id),
  moderated_at timestamptz,
  rejection_reason text check(length(rejection_reason)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index birdshop_marketplace_listings_public
  on public.birdshop_marketplace_listings(status,created_at desc);
create index birdshop_marketplace_listings_seller
  on public.birdshop_marketplace_listings(seller_id,created_at desc);

-- Communication is separate from existing customer/staff service chat.
create table public.birdshop_marketplace_threads (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references public.birdshop_seller_profiles(id) on delete restrict,
  listing_id uuid references public.birdshop_marketplace_listings(id) on delete set null,
  status text not null default 'open' check(status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(buyer_user_id,listing_id)
);
create index birdshop_marketplace_threads_seller
  on public.birdshop_marketplace_threads(seller_id,updated_at desc);
create index birdshop_marketplace_threads_buyer
  on public.birdshop_marketplace_threads(buyer_user_id,updated_at desc);

create table public.birdshop_marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.birdshop_marketplace_threads(id) on delete restrict,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check(length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index birdshop_marketplace_messages_thread
  on public.birdshop_marketplace_messages(thread_id,created_at asc);

-- Financial records are SCHEMA-ONLY until separate provider-neutral checkout.
-- No checkout integration, money collection or seller payouts are enabled.
create table public.birdshop_marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.birdshop_marketplace_listings(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references public.birdshop_seller_profiles(id) on delete restrict,
  quantity integer not null check(quantity between 1 and 10),
  subtotal_cents bigint not null check(subtotal_cents > 0),
  commission_bps integer not null check(commission_bps between 0 and 5000),
  commission_cents bigint not null check(commission_cents between 0 and subtotal_cents),
  currency text not null default 'usd' check(currency='usd'),
  state text not null default 'payment_pending' check(state in
    ('payment_pending','paid','fulfillment_pending','delivered',
     'buyer_confirmed','completed','disputed','refunded','cancelled')),
  payment_provider text,
  payment_reference text,
  paid_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_provider,payment_reference)
);
create index birdshop_marketplace_orders_seller
  on public.birdshop_marketplace_orders(seller_id,created_at desc);

create table public.birdshop_marketplace_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.birdshop_marketplace_orders(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id),
  seller_id uuid not null references public.birdshop_seller_profiles(id),
  reason text not null check(length(reason) between 10 and 3000),
  status text not null default 'open' check(status in
    ('open','under_review','resolved_buyer','resolved_seller','closed')),
  resolution_note text check(length(resolution_note)<=3000),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.birdshop_marketplace_ledger (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.birdshop_seller_profiles(id) on delete restrict,
  order_id uuid references public.birdshop_marketplace_orders(id) on delete restrict,
  event_key text not null unique check(length(event_key) between 8 and 180),
  entry_type text not null check(entry_type in
    ('earned','refund','chargeback','payout','adjustment')),
  amount_cents bigint not null check(amount_cents <> 0),
  status text not null default 'pending' check(status in ('pending','available','settled','void')),
  created_at timestamptz not null default now()
);
create index birdshop_marketplace_ledger_seller
  on public.birdshop_marketplace_ledger(seller_id,created_at desc);

create table public.birdshop_marketplace_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.birdshop_seller_profiles(id) on delete restrict,
  amount_cents bigint not null check(amount_cents > 0),
  status text not null default 'requested' check(status in
    ('requested','approved','rejected','paid')),
  provider_reference text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.birdshop_marketplace_audit (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index birdshop_marketplace_audit_entity
  on public.birdshop_marketplace_audit(entity_type,entity_id,created_at desc);

-- Server-only service role access. No direct anonymous or authenticated writes
-- and no client RLS policies; server actions verify auth.getUser() and ownership.
-- In particular, sellers cannot set their own approval/status/commission.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'birdshop_seller_applications','birdshop_seller_profiles',
    'birdshop_marketplace_listings','birdshop_marketplace_threads',
    'birdshop_marketplace_messages','birdshop_marketplace_orders',
    'birdshop_marketplace_disputes','birdshop_marketplace_ledger',
    'birdshop_marketplace_payouts','birdshop_marketplace_audit'
  ] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant select,insert,update on public.%I to service_role',tbl);
  end loop;
end $$;
grant usage, select on sequence public.birdshop_marketplace_audit_id_seq to service_role;

comment on table public.birdshop_marketplace_orders is
  'Future provider-neutral orders only. No Stripe order finalizer or seller payout path currently uses this.';
comment on table public.birdshop_marketplace_ledger is
  'Schema-only pending marketplace financial integration. Never credit seller balances from unverified payment.';

commit;