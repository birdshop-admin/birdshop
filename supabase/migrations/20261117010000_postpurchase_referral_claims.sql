-- Staged migration: post-purchase first-buyer referral verification.
-- Requires 20261115010000_referral_foundation.sql. Test in staging first.
begin;

alter table public.birdshop_referral_attributions
  add column if not exists verified_at timestamptz,
  add column if not exists claim_source text not null default 'link';

alter table public.birdshop_referral_attributions
  drop constraint if exists birdshop_referral_claim_source_check;
alter table public.birdshop_referral_attributions
  add constraint birdshop_referral_claim_source_check
  check (claim_source in ('link','post_purchase'));

create index if not exists birdshop_referral_verified_customers
  on public.birdshop_referral_attributions(referrer_id,verified_at desc)
  where verified_at is not null;

-- Called ONLY by server-side service role after checking the private order token.
-- Return a harmless status, not referrer identities/customer data.
create or replace function public.birdshop_claim_postpurchase_referral(
  p_order_id uuid, p_code text
) returns text
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_email text;
  v_created_at timestamptz;
  v_paid_at timestamptz;
  v_refunded integer;
  v_payment text;
  v_fulfillment text;
  v_source text;
  v_attempt_id uuid;
  v_session text;
  v_referrer uuid;
  v_existing uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Not permitted'; end if;
  if p_code is null or upper(trim(p_code)) !~ '^[A-Z0-9]{6,20}$' then
    raise exception 'Invalid referral code';
  end if;

  select t.id, lower(o.customer_email), o.created_at, o.paid_at,
         coalesce(o.refunded_amount,0), o.payment_status, o.fulfillment_status,
         o.source, t.stripe_session_id
    into v_attempt_id,v_email,v_created_at,v_paid_at,v_refunded,
         v_payment,v_fulfillment,v_source,v_session
  from public.orders o
  join public.birdshop_checkout_attempts t
    on t.order_id=o.id and t.kind='product'
  where o.id=p_order_id
  order by t.created_at asc
  limit 1;

  if v_attempt_id is null or v_email is null or
     v_paid_at is null or v_payment <> 'paid' or v_refunded > 0 or
     v_source = 'admin_test' or left(coalesce(v_session,''),8)='cs_test_' then
    raise exception 'This order is not eligible for referral credit';
  end if;
  if now() > v_paid_at + interval '7 days' then
    raise exception 'The referral claim window has expired';
  end if;

  -- Serialize claims by paying customer across parallel orders/requests.
  perform pg_advisory_xact_lock(hashtextextended(v_email, 81818));

  select id into v_referrer
    from public.birdshop_referrers
   where code=upper(trim(p_code)) and status='approved'
     and lower(contact_email) <> v_email;
  if v_referrer is null then
    raise exception 'Invalid or ineligible referral code';
  end if;

  select referrer_id into v_existing
    from public.birdshop_referral_attributions
   where attempt_id=v_attempt_id;
  if v_existing is not null then
    if v_existing=v_referrer then return 'already_recorded'; end if;
    raise exception 'This purchase already has a different referral';
  end if;

  -- A referral belongs to the PAYING customer, not a gift recipient.
  -- First purchase only; refunds do not restore "new buyer" status.
  if exists (
    select 1 from public.orders prior
     where lower(prior.customer_email)=v_email
       and prior.id<>p_order_id
       and prior.paid_at is not null
       and prior.created_at<=v_created_at
       and prior.payment_status in ('paid','partially_refunded','refunded')
       and prior.source is distinct from 'admin_test'
       and not exists (
         select 1 from public.birdshop_checkout_attempts pt
          where pt.order_id=prior.id
            and left(coalesce(pt.stripe_session_id,''),8)='cs_test_'
       )
  ) then
    raise exception 'Only a first paid purchase can be referred';
  end if;

  if exists (
    select 1 from public.birdshop_referral_rewards reward
     where lower(reward.referred_email)=v_email
       and reward.status<>'rejected'
  ) then
    raise exception 'This customer already received referral credit';
  end if;

  insert into public.birdshop_referral_attributions
    (attempt_id,referrer_id,referred_email,verified_at,claim_source)
  values (v_attempt_id,v_referrer,v_email,now(),'post_purchase')
  on conflict (attempt_id) do nothing;
  if not found then raise exception 'This purchase already has a referral'; end if;

  -- If the digital item was already fulfilled, the normal order trigger
  -- ran before the claim existed. Issue the SAME owner-reviewed $0.50 reward
  -- here; otherwise the existing fulfillment trigger handles it later.
  if v_fulfillment in ('fulfilled','completed') then
    insert into public.birdshop_referral_rewards(referrer_id,order_id,referred_email)
    values(v_referrer,p_order_id,v_email) on conflict do nothing;
  end if;
  return 'verified';
end;
$$;
revoke all on function public.birdshop_claim_postpurchase_referral(uuid,text)
  from public,anon,authenticated;
grant execute on function public.birdshop_claim_postpurchase_referral(uuid,text)
  to service_role;

notify pgrst,'reload schema';
commit;
