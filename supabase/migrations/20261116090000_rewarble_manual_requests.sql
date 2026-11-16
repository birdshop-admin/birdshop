-- Additive schema for gated Rewarble manual review. Voucher submission is NOT payment.
-- Do not activate code intake or automatic fulfillment simply by applying this schema.
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

-- Transactional owner review. No orders, payments, or inventory are changed.
create or replace function public.birdshop_review_rewarble_request(
  p_id uuid, p_from text, p_to text, p_owner uuid, p_note text
) returns void language plpgsql security definer set search_path = '' as $rewarble$
begin
  perform private.birdshop_require_server();
  if p_owner is null or p_note is null or length(p_note) > 500 or
    not ((p_from='pending_review' and p_to in ('redeemed','rejected')) or
         (p_from='redeemed' and p_to='fulfilled')) then
    raise exception 'Invalid manual review transition.';
  end if;

  update public.birdshop_rewarble_requests
  set status=p_to, reviewed_by=p_owner, reviewed_at=now(),
      review_note=nullif(trim(p_note),''),
      fulfilled_at=case when p_to='fulfilled' then now() else fulfilled_at end,
      encrypted_code=case when p_to in ('redeemed','rejected') then null else encrypted_code end
  where id=p_id and status=p_from;
  if not found then raise exception 'Review request has changed. Refresh and try again.'; end if;
  insert into public.birdshop_rewarble_audit(request_id, actor_id, event)
  values(p_id, p_owner, p_to);
end $rewarble$;
revoke all on function public.birdshop_review_rewarble_request(uuid,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.birdshop_review_rewarble_request(uuid,text,text,uuid,text)
  to service_role;

commit;
