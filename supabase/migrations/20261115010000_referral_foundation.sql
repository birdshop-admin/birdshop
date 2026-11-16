-- BirdShop referrals: private, server-controlled attribution and reward ledger.
-- Apply only after prior migrations; test against a staging database first.
begin;
create table if not exists public.birdshop_referrers (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z0-9]{6,20}$'),
 contact_email text not null check (length(contact_email) <= 320),
 display_name text not null check (length(display_name) between 1 and 80),
 kind text not null default 'customer' check (kind in ('customer','affiliate')),
 status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
 created_at timestamptz not null default now(),
 approved_at timestamptz
);
create unique index if not exists birdshop_referrers_email_unique on public.birdshop_referrers (lower(contact_email));
create table if not exists public.birdshop_referral_attributions (
 attempt_id uuid primary key references public.birdshop_checkout_attempts(id) on delete restrict,
 referrer_id uuid not null references public.birdshop_referrers(id),
 referred_email text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.birdshop_referral_rewards (
 id uuid primary key default gen_random_uuid(),
 referrer_id uuid not null references public.birdshop_referrers(id),
 order_id uuid not null unique references public.orders(id),
 referred_email text not null,
 amount_cents integer not null default 50 check (amount_cents = 50),
 status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','paid','reversed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 paid_at timestamptz
);
create unique index if not exists birdshop_referral_once_per_customer on public.birdshop_referral_rewards (lower(referred_email))
 where status <> 'rejected';
create index if not exists birdshop_referral_rewards_referrer on public.birdshop_referral_rewards(referrer_id,created_at desc);
alter table public.birdshop_referrers enable row level security;
alter table public.birdshop_referral_attributions enable row level security;
alter table public.birdshop_referral_rewards enable row level security;
revoke all on public.birdshop_referrers, public.birdshop_referral_attributions, public.birdshop_referral_rewards from public,anon,authenticated;
grant select,insert,update on public.birdshop_referrers, public.birdshop_referral_attributions, public.birdshop_referral_rewards to service_role;
-- Server-only RPC: bind a referral to a previously created checkout attempt.
create or replace function public.birdshop_attach_referral(p_attempt_id uuid,p_code text)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_email text; v_referrer uuid;
begin
 if auth.role() <> 'service_role' then raise exception 'Not permitted'; end if;
 select lower(customer_email) into v_email from public.birdshop_checkout_attempts
 where id=p_attempt_id and kind='product' and status in ('creating','open');
 if v_email is null then return; end if;
 select id into v_referrer from public.birdshop_referrers
 where code=upper(trim(p_code)) and status='approved' and lower(contact_email) <> v_email;
 if v_referrer is null then return; end if;
 insert into public.birdshop_referral_attributions(attempt_id,referrer_id,referred_email)
 values(p_attempt_id,v_referrer,v_email) on conflict(attempt_id) do nothing;
end $$;
revoke all on function public.birdshop_attach_referral(uuid,text) from public,anon,authenticated;
grant execute on function public.birdshop_attach_referral(uuid,text) to service_role;
-- Reward issuance is owner-reviewed, not an automatic payout.
-- Order completion is evaluated after Stripe payment and fulfillment; webhook retries are idempotent.
create or replace function public.birdshop_award_referral_on_order()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_referrer uuid; v_email text;
begin
 if new.payment_status <> 'paid' or new.paid_at is null then return new; end if;
 if new.fulfillment_status not in ('fulfilled','completed') then return new; end if;
 if new.source = 'admin_test' then return new; end if;
 if exists(select 1 from public.birdshop_checkout_attempts t where t.order_id=new.id and t.stripe_session_id like 'cs\_test\_%') then return new; end if;
 select a.referrer_id, lower(a.referred_email) into v_referrer,v_email
 from public.birdshop_referral_attributions a
 join public.birdshop_checkout_attempts t on t.id=a.attempt_id
 join public.birdshop_referrers r on r.id=a.referrer_id
 where t.order_id=new.id and r.status='approved'
 order by a.created_at asc limit 1;
 if v_referrer is null then return new; end if;
 -- Only genuinely new paying customers qualify, even if their first order was un-referred.
 if exists(select 1 from public.orders o where lower(o.customer_email)=v_email and o.id<>new.id
 and o.paid_at is not null and o.created_at<=new.created_at
 and o.payment_status in ('paid','partially_refunded','refunded')) then return new; end if;
 insert into public.birdshop_referral_rewards(referrer_id,order_id,referred_email)
 values(v_referrer,new.id,v_email) on conflict do nothing;
 return new;
end $$;
drop trigger if exists birdshop_order_referral_reward on public.orders;
create trigger birdshop_order_referral_reward after insert or update of payment_status,paid_at,fulfillment_status on public.orders
for each row execute function public.birdshop_award_referral_on_order();
-- Any refund suspends reward eligibility; paid rewards require manual reconciliation.
create or replace function public.birdshop_reverse_refunded_referral()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.payment_status in ('partially_refunded','refunded') or coalesce(new.refunded_amount,0)>0 then
 update public.birdshop_referral_rewards set status='reversed'
 where order_id=new.id and status in ('pending_review','approved');
 end if;
 return new;
end $$;
drop trigger if exists birdshop_order_referral_refund on public.orders;
create trigger birdshop_order_referral_refund after update of payment_status,refunded_amount on public.orders
for each row execute function public.birdshop_reverse_refunded_referral();
notify pgrst,'reload schema';
commit;
