-- Staging-only Rewarble voucher intake. A voucher submission is NOT an order or payment.
-- Apply manually after backup, review and owner approval; do not run on production yet.
begin;

create table if not exists public.birdshop_rewarble_requests (
  id uuid primary key default gen_random_uuid(),
  access_hash text not null unique check (access_hash ~ '^[a-f0-9]{64}$'),
  customer_name text not null check(length(customer_name) between 1 and 120),
  customer_email text not null check(length(customer_email) between 3 and 320),
  cart jsonb not null check(jsonb_typeof(cart) = 'array' and jsonb_array_length(cart) between 1 and 20),
  expected_cents bigint not null check(expected_cents between 50 and 99999999),
  claimed_cents bigint not null check(claimed_cents between 50 and 99999999),
  currency text not null default 'usd' check(currency = 'usd'),
  code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
  code_hint text not null check(length(code_hint) = 4),
  encrypted_code text,
  status text not null default 'pending_review'
    check(status in ('pending_review','redeemed','rejected','fulfilled')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists birdshop_rewarble_requests_review_idx
  on public.birdshop_rewarble_requests(status, created_at desc);
create index if not exists birdshop_rewarble_requests_email_idx
  on public.birdshop_rewarble_requests(customer_email, created_at desc);

create table if not exists public.birdshop_rewarble_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.birdshop_rewarble_requests(id) on delete restrict,
  actor_id uuid,
  event text not null check(event in ('submitted','code_viewed','redeemed','rejected','fulfilled')),
  created_at timestamptz not null default now()
);
create index if not exists birdshop_rewarble_audit_request_idx
  on public.birdshop_rewarble_audit(request_id, created_at desc);

alter table public.birdshop_rewarble_requests enable row level security;
alter table public.birdshop_rewarble_audit enable row level security;
revoke all on public.birdshop_rewarble_requests from public, anon, authenticated;
revoke all on public.birdshop_rewarble_audit from public, anon, authenticated;
grant select, insert, update on public.birdshop_rewarble_requests to service_role;
grant select, insert on public.birdshop_rewarble_audit to service_role;
grant usage, select on sequence public.birdshop_rewarble_audit_id_seq to service_role;

comment on table public.birdshop_rewarble_requests is
  'Owner-only encrypted voucher review requests. Never mark Stripe orders paid from this table.';
commit;
