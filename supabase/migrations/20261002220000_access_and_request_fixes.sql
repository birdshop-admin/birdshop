-- BirdShop: first database patch, October 2, 2026.
-- Based on the supplied live schema and function definitions.
-- This file CHANGES function definitions, grants, and one index.
-- Run the complete file as one script in Supabase SQL Editor.
-- No customer records, orders, messages, or payment requests are deleted.
-- All changes are inside one transaction; an error prevents commit.
-- Authorization sanity checks run before commit using temporary JWT settings.
-- Scope: access checks, legacy submission access, and active quote uniqueness.
-- Static compatibility checks were completed against the supplied exports.
-- This script has not been executed against PostgreSQL in this workspace.
-- Stripe/webhook races and financial-history deletion require the next package.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Use the existing active-owner rule for inventory, products, and reviews.
-- The old private helper ignored is_active and still allowed a legacy role.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.is_birdshop_owner();
$function$;

revoke all on function private.is_admin() from public, anon, service_role;
grant execute on function private.is_admin() to authenticated;

-- Keep the same return shape used by ServiceAgentChatPage.tsx.
-- A missing or inactive staff record must fail authorization explicitly.
create or replace function public.birdshop_staff_list_service_queue()
returns table (
  id uuid,
  reference text,
  workflow_status text,
  status text,
  last_message_at timestamp with time zone,
  last_sender_type text,
  customer_name text,
  subject text,
  service_name text,
  package_name text,
  request_message text,
  assigned_staff_user_id uuid,
  assigned_to text,
  assigned_at timestamp with time zone,
  is_mine boolean,
  is_unassigned boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_user_id uuid := auth.uid();
begin
  select a.role into v_role
  from public.admin_users a
  where a.user_id = v_user_id and a.is_active = true;

  if coalesce(auth.role(), '') <> 'service_role'
     and coalesce(v_role, '') not in ('owner', 'service_agent') then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  return query
  select
    c.id, c.reference, c.workflow_status, c.status,
    c.last_message_at, c.last_sender_type, c.customer_name,
    c.subject, c.service_name, c.package_name, c.request_message,
    c.assigned_staff_user_id, c.assigned_to, c.assigned_at,
    coalesce(c.assigned_staff_user_id = v_user_id, false),
    c.assigned_staff_user_id is null
  from public.service_conversations c
  where c.conversation_type = 'service'
    and c.status = 'open'
    and c.deleted_at is null
    and (
      v_role = 'owner'
      or c.assigned_staff_user_id is null
      or c.assigned_staff_user_id = v_user_id
    )
  order by
    case
      when c.assigned_staff_user_id is null then 0
      when c.assigned_staff_user_id = v_user_id then 1
      else 2
    end,
    c.last_message_at desc,
    c.id;
end;
$function$;

revoke all on function public.birdshop_staff_list_service_queue()
  from public, anon;
grant execute on function public.birdshop_staff_list_service_queue()
  to authenticated, service_role;

-- This helper is public and SECURITY DEFINER. It needs its own authorization
-- even though order-item triggers also call it.
create or replace function public.birdshop_recalculate_order_total(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_subtotal numeric(12, 2);
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.is_birdshop_owner() is not true then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  -- An order may already be absent during an allowed cascading test deletion.
  if not found then
    return;
  end if;

  -- Service totals come from the verified quote, not product order_items.
  if v_order.order_type <> 'product' then
    return;
  end if;

  -- Existing synthetic tests remain editable. Processor-linked records do not
  -- gain an exception merely because someone changes their source label.
  if (
    v_order.payment_status in ('paid', 'partially_refunded', 'refunded')
    or v_order.paid_at is not null
    or v_order.refunded_amount > 0
    or v_order.stripe_charge_id is not null
  ) and not (
    v_order.source = 'admin_test'
    and v_order.payment_provider is null
    and v_order.payment_reference is null
    and v_order.stripe_charge_id is null
  ) then
    raise exception 'Recorded payment totals cannot be recalculated.';
  end if;

  select coalesce(sum(oi.line_total), 0) into v_subtotal
  from public.order_items oi
  where oi.order_id = p_order_id;

  update public.orders
  set subtotal = v_subtotal,
      total = greatest(v_subtotal - discount_total + tax_total, 0)
  where id = p_order_id;
end;
$function$;

revoke all on function public.birdshop_recalculate_order_total(uuid)
  from public, anon;
grant execute on function public.birdshop_recalculate_order_total(uuid)
  to authenticated, service_role;

-- Check agent assignment after locking the conversation, so an agent cannot
-- create a quote based on an assignment released while waiting for the lock.
-- Keep the RPC signature and returned UUID used by the current application.
create or replace function public.birdshop_staff_create_payment_request(
  p_conversation_id uuid,
  p_amount numeric,
  p_title text,
  p_description text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_conversation public.service_conversations%rowtype;
  v_request_id uuid;
  v_amount numeric(12, 2);
begin
  if auth.uid() is null
     or (public.is_birdshop_owner()
       or public.is_birdshop_service_agent()) is not true then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_amount is null
     or p_amount::text in ('NaN', 'Infinity', '-Infinity')
     or p_amount < 0.50 then
    raise exception 'Payment amount must be a valid amount of at least $0.50.';
  end if;
  v_amount := round(p_amount, 2);

  if length(trim(coalesce(p_title, ''))) < 1
     or length(trim(p_title)) > 180 then
    raise exception 'Payment title must contain 1 to 180 characters.';
  end if;
  if length(coalesce(p_description, '')) > 2000 then
    raise exception 'Payment description is too long.';
  end if;

  select c.* into v_conversation
  from public.service_conversations c
  where c.id = p_conversation_id
  for update;

  if not found then
    raise exception 'Service conversation not found.';
  end if;

  if (
    public.is_birdshop_owner()
    or (
      public.is_birdshop_service_agent()
      and v_conversation.assigned_staff_user_id = auth.uid()
    )
  ) is not true then
    raise exception 'You must accept this service before sending a payment request.'
      using errcode = '42501';
  end if;

  if v_conversation.conversation_type <> 'service'
     or v_conversation.status <> 'open'
     or v_conversation.deleted_at is not null then
    raise exception 'Service conversation is unavailable.';
  end if;
  if v_conversation.order_id is not null then
    raise exception 'This service already has an order.';
  end if;
  if exists (
    select 1 from public.service_payment_requests pr
    where pr.conversation_id = p_conversation_id
      and pr.status in ('pending', 'processing')
  ) then
    raise exception 'This service already has an active payment request.';
  end if;

  insert into public.service_payment_requests (
    conversation_id, order_id, amount, currency, title, description,
    status, created_by, previous_workflow_status
  ) values (
    p_conversation_id, null, v_amount, 'usd', trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    'pending', auth.uid(), v_conversation.workflow_status
  ) returning id into v_request_id;

  insert into public.service_messages (
    conversation_id, sender_type, sender_label, body, message_type, metadata
  ) values (
    p_conversation_id, 'admin', 'BirdShop',
    format('Payment request created for USD %s.',
      to_char(v_amount, 'FM9999999990.00')),
    'payment_request',
    jsonb_build_object('payment_request_id', v_request_id)
  );

  update public.service_conversations
  set workflow_status = 'payment_pending'
  where id = p_conversation_id;

  return v_request_id;
end;
$function$;

revoke all on function public.birdshop_staff_create_payment_request(
  uuid, numeric, text, text
) from public, anon, service_role;
grant execute on function public.birdshop_staff_create_payment_request(
  uuid, numeric, text, text
) to authenticated;

-- These three old submission paths are unused by the uploaded application.
-- Retain their definitions/history, but stop public API clients invoking them.
revoke execute on function public.birdshop_submit_custom_service_quote(
  text, text, text, text
) from public, anon, authenticated;

revoke execute on function public.submit_service_request(
  text, text, text, text, text, text, text, numeric
) from public, anon, authenticated;

revoke execute on function public.submit_support_request(
  text, text, text, text, text, text, text, text, text, text,
  numeric, text, text, text, text, jsonb
) from public, anon, authenticated;

-- Block quote writes briefly while checking/installing this invariant.
-- If newer data conflicts, fail the entire patch rather than modifying it.
lock table public.service_payment_requests in share row exclusive mode;

do $check$
begin
  if exists (
    select conversation_id
    from public.service_payment_requests
    where status in ('pending', 'processing')
    group by conversation_id
    having count(*) > 1
  ) then
    raise exception 'Multiple active payment requests exist. No patch changes were committed.';
  end if;
end;
$check$;

create unique index if not exists
  service_payment_requests_one_active_per_conversation_idx
on public.service_payment_requests (conversation_id)
where status in ('pending', 'processing');

-- Exercise the missing-staff guard before committing. These calls do not
-- create fixture users, conversations, payment requests, or orders.
-- JWT settings are local to this transaction and restored after the checks.
do $verify$
declare
  v_original_claims text := current_setting('request.jwt.claims', true);
  v_original_sub text := current_setting('request.jwt.claim.sub', true);
  v_original_role text := current_setting('request.jwt.claim.role', true);
  v_nonstaff_id uuid := gen_random_uuid();
  v_owner_id uuid;
  v_agent_id uuid;
  v_denied boolean;
  v_signature text;
begin
  while exists (select 1 from public.admin_users where user_id = v_nonstaff_id)
     or exists (select 1 from public.orders where id = v_nonstaff_id) loop
    v_nonstaff_id := gen_random_uuid();
  end loop;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'role', 'authenticated', 'sub', v_nonstaff_id::text
  )::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_nonstaff_id::text, true);

  v_denied := false;
  begin
    perform * from public.birdshop_staff_list_service_queue();
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Verification failed: a non-staff account can read the service queue.';
  end if;

  v_denied := false;
  begin
    perform public.birdshop_recalculate_order_total(v_nonstaff_id);
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Verification failed: a non-staff account can recalculate totals.';
  end if;

  v_denied := false;
  begin
    perform public.birdshop_staff_create_payment_request(
      v_nonstaff_id, 1.00, 'Authorization check', null
    );
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'Verification failed: a non-staff account can create payment requests.';
  end if;

  if private.is_admin() is not false then
    raise exception 'Verification failed: a non-staff account passes the inventory owner check.';
  end if;

  select user_id into v_owner_id
  from public.admin_users
  where role = 'owner' and is_active = true
  order by user_id limit 1;

  if v_owner_id is not null then
    perform set_config('request.jwt.claims', jsonb_build_object(
      'role', 'authenticated', 'sub', v_owner_id::text
    )::text, true);
    perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
    if private.is_admin() is not true then
      raise exception 'Verification failed: the active owner lost inventory access.';
    end if;
    perform * from public.birdshop_staff_list_service_queue();
    perform public.birdshop_recalculate_order_total(v_nonstaff_id);
  end if;

  select user_id into v_agent_id
  from public.admin_users
  where role = 'service_agent' and is_active = true
  order by user_id limit 1;

  if v_agent_id is not null then
    perform set_config('request.jwt.claims', jsonb_build_object(
      'role', 'authenticated', 'sub', v_agent_id::text
    )::text, true);
    perform set_config('request.jwt.claim.sub', v_agent_id::text, true);
    if private.is_admin() is not false then
      raise exception 'Verification failed: a service agent passes the inventory owner check.';
    end if;
    if exists (
      select 1 from public.birdshop_staff_list_service_queue() q
      where q.assigned_staff_user_id is not null
        and q.assigned_staff_user_id <> v_agent_id
    ) then
      raise exception 'Verification failed: a service agent can see another provider''s assigned queue.';
    end if;
    v_denied := false;
    begin
      perform public.birdshop_recalculate_order_total(v_nonstaff_id);
    exception when insufficient_privilege then
      v_denied := true;
    end;
    if not v_denied then
      raise exception 'Verification failed: a service agent can recalculate totals.';
    end if;
  end if;

  perform set_config('request.jwt.claims', coalesce(v_original_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(v_original_role, ''), true);

  if has_function_privilege('anon',
    'public.birdshop_recalculate_order_total(uuid)', 'EXECUTE') then
    raise exception 'Verification failed: anonymous order-total execution remains enabled.';
  end if;

  foreach v_signature in array array[
    'public.birdshop_submit_custom_service_quote(text,text,text,text)',
    'public.submit_service_request(text,text,text,text,text,text,text,numeric)',
    'public.submit_support_request(text,text,text,text,text,text,text,text,text,text,numeric,text,text,text,text,jsonb)'
  ] loop
    if has_function_privilege('anon', v_signature, 'EXECUTE')
       or has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'Verification failed: legacy submission access remains enabled for %.',
        v_signature;
    end if;
  end loop;
end;
$verify$;

notify pgrst, 'reload schema';
commit;
