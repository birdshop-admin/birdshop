-- =========================================================
-- BIRDSHOP CHAT PAYMENTS
--
-- Adds real payment-request objects to native BirdShop Chat.
--
-- Admin:
--   Create payment request
--        ↓
-- Customer:
--   Receives payment card
--        ↓
-- Stripe Checkout
--        ↓
-- Verified webhook
--        ↓
-- PAYMENT = PAID
-- =========================================================


-- =========================================================
-- EXTEND CHAT MESSAGES
-- =========================================================

alter table public.service_messages
add column if not exists message_type text
not null
default 'text';

alter table public.service_messages
add column if not exists metadata jsonb
not null
default '{}'::jsonb;


alter table public.service_messages
drop constraint if exists
service_messages_message_type_check;

alter table public.service_messages
add constraint
service_messages_message_type_check
check (
  message_type in (
    'text',
    'payment_request',
    'system'
  )
);


-- =========================================================
-- PAYMENT REQUESTS
-- =========================================================

create table if not exists
public.service_payment_requests (
  id uuid primary key
    default gen_random_uuid(),

  conversation_id uuid not null
    references public.service_conversations(id)
    on delete cascade,

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  amount numeric(10,2) not null
    check (
      amount >= 0.50
    ),

  currency text not null
    default 'usd',

  title text not null,

  description text,

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'paid',
        'cancelled',
        'expired'
      )
    ),

  stripe_checkout_session_id text,

  stripe_checkout_url text,

  stripe_payment_intent text,

  created_by uuid,

  created_at timestamptz
    not null
    default now(),

  paid_at timestamptz,

  cancelled_at timestamptz
);


create index if not exists
service_payment_requests_conversation_idx
on public.service_payment_requests(
  conversation_id,
  created_at
);


create index if not exists
service_payment_requests_order_idx
on public.service_payment_requests(
  order_id
);


create unique index if not exists
service_payment_requests_one_pending_per_order
on public.service_payment_requests(order_id)
where status = 'pending';


-- =========================================================
-- RLS
-- =========================================================

alter table public.service_payment_requests
enable row level security;


revoke all
on table public.service_payment_requests
from anon,
authenticated;


grant select
on table public.service_payment_requests
to authenticated;


drop policy if exists
"BirdShop admins can read payment requests"
on public.service_payment_requests;


create policy
"BirdShop admins can read payment requests"
on public.service_payment_requests
for select
to authenticated
using (
  public.is_birdshop_admin()
);


-- =========================================================
-- ADMIN CREATE PAYMENT REQUEST
-- =========================================================

create or replace function
public.birdshop_admin_create_payment_request(
  p_conversation_id uuid,
  p_amount numeric,
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_request_id uuid;
begin

  if
    coalesce(
      auth.role(),
      ''
    ) <> 'service_role'

    and not public.is_birdshop_admin()
  then
    raise exception
      'Not authorized.';
  end if;


  if p_amount < 0.50 then
    raise exception
      'Payment request must be at least $0.50.';
  end if;


  if trim(
    coalesce(
      p_title,
      ''
    )
  ) = '' then
    raise exception
      'Payment request title is required.';
  end if;


  select o.*
  into v_order

  from public.orders o

  join public.service_conversations c
    on c.order_id = o.id

  where c.id =
    p_conversation_id

    and c.status =
      'open'

    and c.deleted_at
      is null

    and o.deleted_at
      is null

  for update;


  if not found then
    raise exception
      'Service conversation not found.';
  end if;


  if v_order.order_type <> 'service' then
    raise exception
      'Payment requests are only available for service orders.';
  end if;


  if v_order.payment_status = 'paid' then
    raise exception
      'This service order is already paid.';
  end if;


  if exists (
    select 1
    from public.service_payment_requests
    where order_id =
      v_order.id

      and status =
        'pending'
  ) then
    raise exception
      'This order already has a pending payment request.';
  end if;


  insert into public.service_payment_requests (
    conversation_id,
    order_id,
    amount,
    title,
    description,
    created_by
  )
  values (
    p_conversation_id,
    v_order.id,
    round(
      p_amount,
      2
    ),
    trim(
      p_title
    ),
    nullif(
      trim(
        coalesce(
          p_description,
          ''
        )
      ),
      ''
    ),
    auth.uid()
  )

  returning id
  into v_request_id;


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

    'admin',

    'BirdShop',

    'BirdShop sent a payment request.',

    'payment_request',

    jsonb_build_object(
      'payment_request_id',
      v_request_id
    )
  );


  update public.orders
  set
    service_status =
      case
        when service_status in (
          'new',
          'discussing',
          'quote_sent',
          'customer_replied'
        )
        then 'awaiting_payment'

        else service_status
      end

  where id =
    v_order.id;


  return v_request_id;

end;
$$;


-- =========================================================
-- CANCEL PAYMENT REQUEST
-- =========================================================

create or replace function
public.birdshop_admin_cancel_payment_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_payment_requests%rowtype;
begin

  if
    coalesce(
      auth.role(),
      ''
    ) <> 'service_role'

    and not public.is_birdshop_admin()
  then
    raise exception
      'Not authorized.';
  end if;


  select *
  into v_request

  from public.service_payment_requests

  where id =
    p_request_id

  for update;


  if not found then
    raise exception
      'Payment request not found.';
  end if;


  if v_request.status <> 'pending' then
    raise exception
      'Only pending payment requests can be cancelled.';
  end if;


  update public.service_payment_requests
  set
    status =
      'cancelled',

    cancelled_at =
      now()

  where id =
    p_request_id;


  insert into public.service_messages (
    conversation_id,
    sender_type,
    sender_label,
    body,
    message_type
  )
  values (
    v_request.conversation_id,

    'system',

    'BirdShop',

    'The payment request was cancelled.',

    'system'
  );

end;
$$;


-- =========================================================
-- UPDATE CUSTOMER CHAT RPC
-- =========================================================

create or replace function
public.birdshop_get_service_chat(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_result jsonb;
begin

  select
    c.id

  into
    v_conversation_id

  from public.service_conversations c

  join public.orders o
    on o.id = c.order_id

  where c.public_token =
    trim(p_token)

    and c.deleted_at
      is null

    and o.deleted_at
      is null

  limit 1;


  if v_conversation_id is null then
    raise exception
      'Conversation not found.';
  end if;


  update public.service_conversations
  set
    customer_last_read_at =
      now()

  where id =
    v_conversation_id;


  select
    jsonb_build_object(

      'conversation_id',
        c.id,

      'reference',
        o.reference,

      'service_name',
        o.service_name,

      'package_name',
        o.package_name,

      'total',
        o.total,

      'payment_status',
        o.payment_status,

      'service_status',
        o.service_status,

      'customer_name',
        o.customer_name,

      'conversation_status',
        c.status,


      'messages',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(

                'id',
                  m.id,

                'sender_type',
                  m.sender_type,

                'sender_label',
                  m.sender_label,

                'body',
                  m.body,

                'message_type',
                  m.message_type,

                'metadata',
                  m.metadata,

                'created_at',
                  m.created_at
              )

              order by
                m.created_at
            )

            from public.service_messages m

            where m.conversation_id =
              c.id
          ),

          '[]'::jsonb
        ),


      'payment_requests',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(

                'id',
                  p.id,

                'amount',
                  p.amount,

                'currency',
                  p.currency,

                'title',
                  p.title,

                'description',
                  p.description,

                'status',
                  p.status,

                'created_at',
                  p.created_at,

                'paid_at',
                  p.paid_at
              )

              order by
                p.created_at
            )

            from public.service_payment_requests p

            where p.conversation_id =
              c.id
          ),

          '[]'::jsonb
        )

    )

  into
    v_result

  from public.service_conversations c

  join public.orders o
    on o.id = c.order_id

  where c.id =
    v_conversation_id;


  return v_result;

end;
$$;


-- =========================================================
-- PERMISSIONS
-- =========================================================

revoke all
on function
public.birdshop_admin_create_payment_request(
  uuid,
  numeric,
  text,
  text
)
from public;


grant execute
on function
public.birdshop_admin_create_payment_request(
  uuid,
  numeric,
  text,
  text
)
to authenticated,
service_role;


revoke all
on function
public.birdshop_admin_cancel_payment_request(uuid)
from public;


grant execute
on function
public.birdshop_admin_cancel_payment_request(uuid)
to authenticated,
service_role;


notify pgrst, 'reload schema';