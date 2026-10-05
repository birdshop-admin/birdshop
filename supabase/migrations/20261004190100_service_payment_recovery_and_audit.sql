-- RUN 1 continuation. PENDING final coordinated deployment after Run 3.
begin;
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
  if p.order_id is null and p.status<>'paid' then
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
 update public.birdshop_checkout_attempts set status='failed' where id=a.id;
 return true;
end $$;

create or replace function public.birdshop_sync_service_refund(p_payment_intent_id text,p_charge_id text,p_amount_refunded bigint,p_currency text,p_is_fully_refunded boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.service_payment_requests%rowtype; o public.orders%rowtype; c_id uuid; v_refund_amount numeric; full_refund boolean;
begin
  perform private.birdshop_require_server();
  select conversation_id into c_id from public.service_payment_requests where stripe_payment_intent_id=p_payment_intent_id;
  if c_id is not null then perform 1 from public.service_conversations where id=c_id for update; end if;
  select * into p from public.service_payment_requests where stripe_payment_intent_id=p_payment_intent_id for update;
  select * into o from public.orders where payment_provider='stripe' and payment_reference=p_payment_intent_id for update;
  if not found then return null; end if;
  if p_amount_refunded is null or p_amount_refunded<0 or lower(o.currency) is distinct from lower(p_currency) then raise exception 'Invalid refund.'; end if;
  v_refund_amount:=p_amount_refunded::numeric/100;
  if v_refund_amount>o.total then raise exception 'Refund exceeds recorded payment.'; end if;
  if v_refund_amount<o.refunded_amount then return o.id; end if;
  full_refund:=v_refund_amount=o.total and v_refund_amount>0;
  if p_is_fully_refunded is distinct from full_refund then raise exception 'Refund total does not match full-refund flag.'; end if;
  if v_refund_amount=0 then return o.id; end if;
  update public.orders set refunded_amount=v_refund_amount,refund_updated_at=now(),refunded_at=case when full_refund then coalesce(refunded_at,now()) else refunded_at end,
   stripe_charge_id=p_charge_id,payment_status=case when full_refund then 'refunded' else 'partially_refunded' end,
   order_status=case when full_refund then 'refunded' else order_status end,
   service_status=case when full_refund and order_type='service' and service_status is distinct from 'completed' then 'cancelled' else service_status end
   where id=o.id;
  if p.id is not null then
    update public.service_payment_requests set refunded_amount=v_refund_amount,refund_status=case when full_refund then 'full' else 'partial' end,
     stripe_payment_status=case when full_refund then 'refunded' else 'partially_refunded' end,stripe_charge_id=p_charge_id,refund_updated_at=now(),refunded_at=case when full_refund then coalesce(refunded_at,now()) else refunded_at end where id=p.id;
    if full_refund then update public.service_conversations set workflow_status=case when workflow_status='completed' then 'completed' else 'cancelled' end where id=c_id; end if;
    if v_refund_amount>o.refunded_amount then insert into public.service_messages(conversation_id,sender_type,sender_label,body,message_type)
     values(c_id,'system','BirdShop',case when full_refund then 'Payment fully refunded.' else 'A partial refund has been recorded.' end,'system'); end if;
  end if;
  return o.id;
end $$;

create or replace function private.birdshop_protect_payment_state() returns trigger language plpgsql security definer set search_path='' as $$ begin
  if coalesce(auth.role(),'')<>'service_role' then
    if tg_op='INSERT' then
      if new.payment_provider='stripe' or new.payment_reference is not null or (new.source<>'admin_test' and new.payment_status in ('paid','partially_refunded','refunded')) then raise exception 'Verified server payment required.'; end if;
    elsif (new.payment_status,new.payment_provider,new.payment_reference,new.paid_at,new.refunded_amount,new.stripe_charge_id) is distinct from (old.payment_status,old.payment_provider,old.payment_reference,old.paid_at,old.refunded_amount,old.stripe_charge_id) and not (new.source='admin_test' and old.source='admin_test' and new.payment_provider is distinct from 'stripe' and new.payment_reference is null and old.payment_reference is null and new.stripe_charge_id is null) then
      raise exception 'Verified server payment required.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists birdshop_v2_payment_state on public.orders;
create trigger birdshop_v2_payment_state before insert or update on public.orders for each row execute function private.birdshop_protect_payment_state();


-- Additional recovery/audit definitions follow.

-- Persist processor observations without permitting a stale event to reverse payment.
create or replace function public.birdshop_v2_observe_checkout(p_attempt_id uuid,p_session_id text,p_intent_id text,p_customer_id text,p_payment_status text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.birdshop_checkout_attempts%rowtype; c_id uuid;
begin
 perform private.birdshop_require_server();
 select p.conversation_id into c_id from public.service_payment_requests p join public.birdshop_checkout_attempts x on x.payment_request_id=p.id where x.id=p_attempt_id;
 perform 1 from public.service_conversations where id=c_id for update;
 perform 1 from public.service_payment_requests where id=(select payment_request_id from public.birdshop_checkout_attempts where id=p_attempt_id) for update;
 select * into a from public.birdshop_checkout_attempts where id=p_attempt_id for update;
 if not found or a.stripe_session_id is distinct from p_session_id or p_payment_status is null or p_payment_status not in ('paid','unpaid','no_payment_required') then raise exception 'Checkout observation mismatch.'; end if;
 if a.payment_intent_id is not null and p_intent_id is not null and a.payment_intent_id<>p_intent_id then raise exception 'Payment identity mismatch.'; end if;
 update public.birdshop_checkout_attempts set payment_intent_id=coalesce(p_intent_id,payment_intent_id),stripe_customer_id=coalesce(p_customer_id,stripe_customer_id),
  stripe_payment_status=case when stripe_payment_status='paid' then 'paid' else p_payment_status end,last_checked_at=now() where id=a.id;
end $$;

-- Refund failures use the same conversation -> request -> order lock order.
create or replace function public.birdshop_record_service_refund_failure(p_payment_intent_id text,p_charge_id text,p_refund_id text,p_failure_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.service_payment_requests%rowtype; c_id uuid;
begin
 perform private.birdshop_require_server();
 if nullif(trim(p_payment_intent_id),'') is null or nullif(trim(p_refund_id),'') is null then raise exception 'Refund identity required.'; end if;
 select conversation_id into c_id from public.service_payment_requests where stripe_payment_intent_id=p_payment_intent_id;
 if c_id is null then return null; end if;
 perform 1 from public.service_conversations where id=c_id for update;
 select * into p from public.service_payment_requests where stripe_payment_intent_id=p_payment_intent_id for update;
 if p.order_id is not null then perform 1 from public.orders where id=p.order_id for update; end if;
 if p.stripe_last_refund_id is distinct from p_refund_id or p.refund_failure_reason is distinct from left(coalesce(p_failure_reason,'Refund failed'),500) then
  update public.service_payment_requests set stripe_charge_id=coalesce(p_charge_id,stripe_charge_id),stripe_last_refund_id=p_refund_id,
   refund_failed_at=now(),refund_failure_reason=left(coalesce(p_failure_reason,'Refund failed'),500),refund_updated_at=now() where id=p.id;
 end if;
 insert into public.birdshop_audit_log(action,entity_id,details) values('refund_failure',p.id,jsonb_build_object('refund_id',p_refund_id,'order_id',p.order_id)) on conflict do nothing;
 return p.order_id;
end $$;
create unique index if not exists birdshop_audit_refund_failure_once on public.birdshop_audit_log(action,entity_id,(details->>'refund_id')) where action='refund_failure';

create or replace function private.birdshop_attempt_timestamps() returns trigger language plpgsql set search_path='' as $$ begin
 if new.status='paid' then new.completed_at:=coalesce(new.completed_at,now());new.stripe_payment_status:='paid';
 elsif new.status='failed' then new.failed_at:=coalesce(new.failed_at,now());
 elsif new.status='expired' then new.expired_at:=coalesce(new.expired_at,now());
 elsif new.status='cancelled' then new.cancelled_at:=coalesce(new.cancelled_at,now()); end if;
 return new;
end $$;
drop trigger if exists birdshop_attempt_timestamps on public.birdshop_checkout_attempts;
create trigger birdshop_attempt_timestamps before insert or update of status on public.birdshop_checkout_attempts for each row execute function private.birdshop_attempt_timestamps();

-- Preserve only known historical timestamps; do not invent missing processor event times.
update public.birdshop_checkout_attempts a set completed_at=p.paid_at,cancelled_at=p.cancelled_at,
 created_at=coalesce(p.checkout_created_at,p.created_at),stripe_customer_id=p.stripe_customer_id,
 stripe_payment_status=case when a.status='paid' then 'paid' else p.stripe_payment_status end
 from public.service_payment_requests p where p.id=a.payment_request_id and a.stripe_session_id is not null;

-- Audits contain actor/record IDs and bounded state/amount facts, never access tokens, code values or processor payloads.
create or replace function private.birdshop_financial_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare action_name text; actor uuid:=auth.uid(); entity uuid; facts jsonb:='{}';
begin
 if tg_table_name='service_payment_requests' then
  entity:=new.id;
  if tg_op='INSERT' then action_name:='payment_request_created';facts:=jsonb_build_object('conversation_id',new.conversation_id,'amount',new.amount,'currency',new.currency);
  elsif old.order_id is null and new.order_id is not null then action_name:='payment_finalized';facts:=jsonb_build_object('order_id',new.order_id);
  elsif new.status='cancelled' and old.status is distinct from new.status then
   action_name:='cancellation_committed';
   select cancel_requested_by into actor from public.birdshop_checkout_attempts where payment_request_id=new.id and cancel_requested_at is not null order by created_at desc limit 1;
   actor:=coalesce(actor,auth.uid(),nullif(current_setting('birdshop.actor_id',true),'')::uuid);
  end if;
 elsif tg_table_name='birdshop_checkout_attempts' then
  entity:=new.id;
  if tg_op='UPDATE' and old.cancel_requested_at is null and new.cancel_requested_at is not null then action_name:='cancellation_prepared';actor:=new.cancel_requested_by;
  elsif tg_op='INSERT' then action_name:='checkout_attempt_created';facts:=jsonb_build_object('payment_request_id',new.payment_request_id,'attempt_number',new.attempt_number);
  elsif old.status is distinct from new.status then action_name:='checkout_state_changed';facts:=jsonb_build_object('from',old.status,'to',new.status); end if;
 elsif tg_table_name='orders' then
  if tg_op='DELETE' then entity:=old.id;action_name:='order_permanently_deleted';
  else
   entity:=new.id;
   if new.refunded_amount>old.refunded_amount then action_name:='refund_synchronized';facts:=jsonb_build_object('cumulative_amount',new.refunded_amount,'currency',new.currency);
   elsif new.deleted_at is distinct from old.deleted_at then action_name:=case when new.deleted_at is null then 'order_restored' else 'order_soft_deleted' end;
   elsif new.archived_at is distinct from old.archived_at then action_name:=case when new.archived_at is null then 'order_unarchived' else 'order_archived' end; end if;
  end if;
 elsif tg_table_name='service_conversations' then
  if tg_op='DELETE' then entity:=old.id;action_name:='conversation_permanently_deleted';
  else
   entity:=new.id;
   if new.assigned_staff_user_id is distinct from old.assigned_staff_user_id then action_name:='service_assignment_changed';facts:=jsonb_build_object('from',old.assigned_staff_user_id,'to',new.assigned_staff_user_id);
   elsif new.deleted_at is distinct from old.deleted_at then action_name:=case when new.deleted_at is null then 'conversation_restored' else 'conversation_soft_deleted' end;end if;
  end if;
 end if;
 if action_name is not null then insert into public.birdshop_audit_log(actor_id,action,entity_id,details) values(actor,action_name,entity,facts);end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
drop trigger if exists birdshop_financial_audit on public.service_payment_requests;
create trigger birdshop_financial_audit after insert or update on public.service_payment_requests for each row execute function private.birdshop_financial_audit();
drop trigger if exists birdshop_financial_audit on public.birdshop_checkout_attempts;
create trigger birdshop_financial_audit after insert or update on public.birdshop_checkout_attempts for each row execute function private.birdshop_financial_audit();
drop trigger if exists birdshop_financial_audit on public.orders;
create trigger birdshop_financial_audit after update or delete on public.orders for each row execute function private.birdshop_financial_audit();
drop trigger if exists birdshop_financial_audit on public.service_conversations;
create trigger birdshop_financial_audit after update or delete on public.service_conversations for each row execute function private.birdshop_financial_audit();

-- Clean only genuinely nonfinancial records, using the same lock hierarchy as payment processing.
create or replace function private.birdshop_cleanup_order(p_order_id uuid,p_test_only boolean) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;begin
 if coalesce(auth.role(),'')<>'service_role' and not public.is_birdshop_owner() then raise exception 'Active owner required.';end if;
 perform 1 from public.service_conversations where order_id=p_order_id or id in(select conversation_id from public.service_payment_requests where order_id=p_order_id) order by id for update;
 perform 1 from public.service_payment_requests where order_id=p_order_id order by id for update;
 perform 1 from public.birdshop_checkout_attempts where order_id=p_order_id order by id for update;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order unavailable.';end if;
 if private.birdshop_is_financial(o) then raise exception 'Financial orders are retained. Use Archive or soft Delete.';end if;
 if p_test_only and o.source<>'admin_test' then raise exception 'Only synthetic test orders can use this cleanup.';end if;
 if not p_test_only and o.deleted_at is null then raise exception 'Move the order to Deleted before permanent cleanup.';end if;
 perform 1 from public.products where id in(select product_id from public.order_items where order_id=o.id) order by id for update;
 update public.product_inventory set status='available',reserved_reference=null,reserved_at=null,sold_at=null
  where id in(select product_inventory_id from public.order_fulfillments where order_id=o.id) and status in ('reserved','sold');
 delete from public.order_fulfillments where order_id=o.id;
 delete from public.order_items where order_id=o.id;
 delete from public.orders where id=o.id;
end $$;
create or replace function public.birdshop_permanently_delete_order(p_order_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin perform private.birdshop_cleanup_order(p_order_id,false);end $$;
create or replace function public.birdshop_delete_test_order(p_order_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin perform private.birdshop_cleanup_order(p_order_id,true);end $$;

-- Inventory cleanup shares the same financial guard and lock hierarchy as order cleanup.
create or replace function public.birdshop_reset_test_inventory_sale(p_inventory_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_order uuid;begin
 if coalesce(auth.role(),'')<>'service_role' and not public.is_birdshop_owner() then raise exception 'Active owner required.';end if;
 select order_id into v_order from public.order_fulfillments where product_inventory_id=p_inventory_id;
 if v_order is null then raise exception 'No linked test order.';end if;
 perform private.birdshop_cleanup_order(v_order,true);
end $$;
create or replace function public.birdshop_delete_test_fulfilled_inventory(p_inventory_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_order uuid;begin
 if coalesce(auth.role(),'')<>'service_role' and not public.is_birdshop_owner() then raise exception 'Active owner required.';end if;
 select order_id into v_order from public.order_fulfillments where product_inventory_id=p_inventory_id;
 if v_order is null then raise exception 'No linked test order.';end if;
 perform private.birdshop_cleanup_order(v_order,true);
 delete from public.product_inventory where id=p_inventory_id and status='available'
  and not exists(select 1 from public.order_fulfillments where product_inventory_id=p_inventory_id);
 if not found then raise exception 'Inventory assignment changed; cleanup was rolled back.';end if;
end $$;
revoke all on function public.birdshop_reset_test_inventory_sale(uuid),public.birdshop_delete_test_fulfilled_inventory(uuid) from public,anon;
grant execute on function public.birdshop_reset_test_inventory_sale(uuid),public.birdshop_delete_test_fulfilled_inventory(uuid) to authenticated,service_role;

-- Claim validates active staff and UUID assignment after acquiring the conversation lock.
CREATE OR REPLACE FUNCTION public.birdshop_staff_accept_service_conversation(p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare

  v_staff
    public.admin_users%rowtype;

  v_conversation
    public.service_conversations%rowtype;

  v_display_name text;

  v_customer_message text;

begin

  /* =======================================================
     STAFF
  ======================================================= */

  /* =======================================================
     LOCK SERVICE
  ======================================================= */

  select
    *
  into
    v_conversation
  from public.service_conversations
  where
    id = p_conversation_id
  for update;


  if not found then
    raise exception
      'Service request not found.';
  end if;


  if
    v_conversation.conversation_type <> 'service'
  then
    raise exception
      'Only service conversations may be accepted.';
  end if;


  if
    v_conversation.deleted_at is not null
    or v_conversation.status <> 'open'
  then
    raise exception
      'This service request is unavailable.';
  end if;


  select
    *
  into
    v_staff
  from public.admin_users
  where
    user_id = auth.uid()
    and is_active = true
  limit 1;


  if
    v_staff.user_id is null
    or v_staff.role not in (
      'owner',
      'service_agent'
    )
  then
    raise exception
      'Not authorized.';
  end if;



  /* =======================================================
     ALREADY ASSIGNED
  ======================================================= */

  if
    v_conversation.assigned_staff_user_id is not null
  then

    if
      v_conversation.assigned_staff_user_id = auth.uid()
    then

      return jsonb_build_object(
        'ok',
          true,

        'claimed',
          false,

        'already_assigned',
          true,

        'conversation_id',
          v_conversation.id,

        'assigned_to',
          v_conversation.assigned_to
      );

    end if;


    /*
     * Owner may still ENTER and REPLY to another provider's
     * conversation, but focusing the box does not steal it.
     */

    if
      v_staff.role = 'owner'
    then

      return jsonb_build_object(
        'ok',
          true,

        'claimed',
          false,

        'already_assigned',
          true,

        'conversation_id',
          v_conversation.id,

        'assigned_to',
          v_conversation.assigned_to
      );

    end if;


    raise exception
      'Another BirdShop service provider already accepted this request.';

  end if;


  /* =======================================================
     DISPLAY NAME
  ======================================================= */

  v_display_name :=
    coalesce(
      nullif(
        trim(
          v_staff.display_name
        ),
        ''
      ),

      case
        when
          v_staff.role = 'owner'
          then 'BirdShop Owner'

        else
          'BirdShop Service Provider'
      end
    );


  /* =======================================================
     CLAIM

     DO NOT change workflow_status here.
  ======================================================= */

  update public.service_conversations
  set
    assigned_staff_user_id =
      auth.uid(),

    assigned_to =
      v_display_name,

    assigned_at =
      now()

  where
    id =
      p_conversation_id;


  /* =======================================================
     CUSTOMER CONNECTION MESSAGE
  ======================================================= */

  if
    v_staff.role = 'owner'
  then

    v_customer_message :=
      format(
        'You''re now connected with %s from BirdShop. They''ll be handling your service request from here.',
        v_display_name
      );

  else

    v_customer_message :=
      format(
        'You''re now connected with %s, a BirdShop service provider. They''ll be handling your service request from here.',
        v_display_name
      );

  end if;


  insert into public.service_messages (
    conversation_id,
    sender_type,
    sender_label,
    body,
    message_type,
    metadata
  )
  values (
    p_conversation_id,

    'system',

    'BirdShop',

    v_customer_message,

    'system',

    jsonb_build_object(
      'event',
        'service_provider_connected',

      'staff_user_id',
        auth.uid(),

      'staff_name',
        v_display_name,

      'staff_role',
        v_staff.role
    )
  );


  return jsonb_build_object(
    'ok',
      true,

    'claimed',
      true,

    'already_assigned',
      false,

    'conversation_id',
      p_conversation_id,

    'assigned_to',
      v_display_name,

    'role',
      v_staff.role
  );

end;
$function$
;
revoke all on function public.birdshop_staff_accept_service_conversation(uuid) from public,anon;
grant execute on function public.birdshop_staff_accept_service_conversation(uuid) to authenticated;
-- Replace the known read-marker caller, not the unseen legacy helper it used.
create or replace function public.birdshop_staff_mark_service_chat_read(p_conversation_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.service_conversations where id=p_conversation_id for update;
 if not exists(select 1 from public.admin_users s join public.service_conversations c on c.id=p_conversation_id where s.user_id=auth.uid() and s.is_active
   and (s.role='owner' or(s.role='service_agent' and c.assigned_staff_user_id=s.user_id))) then raise exception 'Not authorized.';end if;
 update public.service_conversations set admin_last_read_at=now() where id=p_conversation_id and deleted_at is null;
end $$;

-- Preserve available Charge identity separately from email/refund processing.
create or replace function public.birdshop_v2_record_charge(p_intent_id text,p_charge_id text,p_amount bigint,p_currency text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.service_payment_requests%rowtype;o public.orders%rowtype;c_id uuid;
begin
 perform private.birdshop_require_server();
 select conversation_id into c_id from public.service_payment_requests where stripe_payment_intent_id=p_intent_id;
 if c_id is null then raise exception 'Linked payment required.';end if;
 perform 1 from public.service_conversations where id=c_id for update;
 select * into p from public.service_payment_requests where stripe_payment_intent_id=p_intent_id for update;
 select * into o from public.orders where id=p.order_id for update;
 if o.id is null or o.payment_provider is distinct from 'stripe' or o.payment_reference is distinct from p_intent_id
  or nullif(p_charge_id,'') is null or p_amount is distinct from round(o.total*100)::bigint or lower(p_currency) is distinct from lower(o.currency)
  or (o.stripe_charge_id is not null and o.stripe_charge_id<>p_charge_id) or (p.stripe_charge_id is not null and p.stripe_charge_id<>p_charge_id)
  then raise exception 'Charge identity or amount mismatch.';end if;
 update public.orders set stripe_charge_id=p_charge_id where id=o.id;
 update public.service_payment_requests set stripe_charge_id=p_charge_id where id=p.id;
end $$;

-- Whitelist record IDs/table names for nonfinancial cleanup; never copy deleted row contents.
create or replace function private.birdshop_audit_cleanup() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.birdshop_audit_log(actor_id,action,entity_id,details)
 values(auth.uid(),'record_permanently_deleted',old.id,jsonb_build_object('table',tg_table_name));
 return old;
end $$;
revoke all on function private.birdshop_audit_cleanup() from public,anon,authenticated;
do $$ declare t text;begin
 foreach t in array array['products','product_inventory','reviews','support_requests','service_payment_requests','order_fulfillments','order_items'] loop
  execute format('drop trigger if exists birdshop_audit_cleanup on public.%I',t);
  execute format('create trigger birdshop_audit_cleanup after delete on public.%I for each row execute function private.birdshop_audit_cleanup()',t);
 end loop;
end $$;

-- Financial transitions are SECURITY DEFINER to update several RLS-protected tables atomically;
-- they additionally require the verified service_role claim. Owner wrappers check active owner themselves.
do $$ declare f regprocedure;begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and (proname like 'birdshop_v2_%' or proname in ('birdshop_finalize_service_payment','birdshop_sync_service_refund','birdshop_record_service_refund_failure','birdshop_rate_limit')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to service_role',f);
 end loop;
 for f in select oid::regprocedure from pg_proc where pronamespace='private'::regnamespace and proname in ('birdshop_cleanup_order','birdshop_financial_audit','birdshop_attempt_timestamps','birdshop_protect_history','birdshop_protect_sold_code','birdshop_protect_payment_state','birdshop_queue_conversation_email') loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
 end loop;
end $$;
revoke all on function public.birdshop_staff_mark_service_chat_read(uuid) from public,anon;
grant execute on function public.birdshop_staff_mark_service_chat_read(uuid) to authenticated;
revoke all on function public.birdshop_permanently_delete_order(uuid),public.birdshop_delete_test_order(uuid) from public,anon;
grant execute on function public.birdshop_permanently_delete_order(uuid),public.birdshop_delete_test_order(uuid) to authenticated,service_role;
-- Browser writes cannot bypass quote validation or coordinated cancellation.
-- SECURITY DEFINER quote RPCs retain their narrowly checked write authority.
alter table public.service_payment_requests enable row level security;
drop policy if exists "Admins can manage payment requests" on public.service_payment_requests;
revoke insert,update,delete,truncate,references,trigger on public.service_payment_requests from public,anon,authenticated;
do $$ declare cols text;begin
 select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name='service_payment_requests';
 execute 'revoke insert('||cols||'),update('||cols||'),references('||cols||') on public.service_payment_requests from public,anon,authenticated';
end $$;
grant select on public.service_payment_requests to authenticated;
revoke truncate on public.orders,public.order_items,public.order_fulfillments,public.product_inventory,public.service_conversations,public.service_messages from public,anon,authenticated;
revoke all on function public.birdshop_admin_create_payment_request(uuid,numeric,text,text) from public,anon;
grant execute on function public.birdshop_admin_create_payment_request(uuid,numeric,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
