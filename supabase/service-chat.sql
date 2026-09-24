-- =========================================================
-- BIRDSHOP SERVICE CHAT
--
-- Native BirdShop customer <-> staff conversations.
--
-- Every service order receives one private conversation.
-- Public users NEVER receive direct table access.
-- Customer access happens only through security-definer
-- RPCs and a long random conversation token.
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- REQUIRED ORDER FIELDS
-- =========================================================

alter table public.orders
add column if not exists service_request_message text;

alter table public.orders
add column if not exists service_contact_handle text;

alter table public.orders
add column if not exists deleted_at timestamptz;


-- =========================================================
-- SERVICE CONVERSATIONS
-- =========================================================

create table if not exists public.service_conversations (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null unique
    references public.orders(id)
    on delete cascade,

  public_token text not null unique
    default encode(
      gen_random_bytes(32),
      'hex'
    ),

  status text not null default 'open'
    check (
      status in (
        'open',
        'closed'
      )
    ),

  last_message_at timestamptz
    not null default now(),

  last_sender_type text
    check (
      last_sender_type is null
      or last_sender_type in (
        'customer',
        'admin',
        'system'
      )
    ),

  admin_last_read_at timestamptz,
  customer_last_read_at timestamptz,

  deleted_at timestamptz,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);


create index if not exists
service_conversations_order_id_idx
on public.service_conversations(order_id);


create index if not exists
service_conversations_last_message_idx
on public.service_conversations(
  last_message_at desc
);


-- =========================================================
-- MESSAGES
-- =========================================================

create table if not exists public.service_messages (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.service_conversations(id)
    on delete cascade,

  sender_type text not null
    check (
      sender_type in (
        'customer',
        'admin',
        'system'
      )
    ),

  sender_label text,

  body text not null
    check (
      char_length(body)
      between 1 and 4000
    ),

  created_at timestamptz
    not null default now()
);


create index if not exists
service_messages_conversation_idx
on public.service_messages(
  conversation_id,
  created_at
);


-- =========================================================
-- UPDATED AT
-- =========================================================

create or replace function
public.birdshop_service_chat_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


drop trigger if exists
service_conversations_touch_updated_at
on public.service_conversations;


create trigger
service_conversations_touch_updated_at
before update
on public.service_conversations
for each row
execute function
public.birdshop_service_chat_touch_updated_at();


-- =========================================================
-- MESSAGE -> CONVERSATION ACTIVITY
-- =========================================================

create or replace function
public.birdshop_service_message_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  update public.service_conversations
  set
    last_message_at = new.created_at,
    last_sender_type = new.sender_type
  where id = new.conversation_id;

  return new;

end;
$$;


drop trigger if exists
service_messages_activity
on public.service_messages;


create trigger
service_messages_activity
after insert
on public.service_messages
for each row
execute function
public.birdshop_service_message_activity();


-- =========================================================
-- AUTO-CREATE CHAT FOR SERVICE ORDERS
-- =========================================================

create or replace function
public.birdshop_create_service_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_initial_message text;
begin

  if new.order_type <> 'service' then
    return new;
  end if;


  insert into public.service_conversations (
    order_id
  )
  values (
    new.id
  )
  on conflict (order_id)
  do nothing
  returning id
  into v_conversation_id;


  if v_conversation_id is null then

    select id
    into v_conversation_id
    from public.service_conversations
    where order_id = new.id;

  end if;


  v_initial_message :=
    nullif(
      trim(
        coalesce(
          new.service_request_message,
          new.notes,
          ''
        )
      ),
      ''
    );


  if
    v_initial_message is not null
    and not exists (
      select 1
      from public.service_messages
      where conversation_id =
        v_conversation_id
    )
  then

    insert into public.service_messages (
      conversation_id,
      sender_type,
      sender_label,
      body,
      created_at
    )
    values (
      v_conversation_id,
      'customer',
      coalesce(
        nullif(
          trim(new.customer_name),
          ''
        ),
        'Customer'
      ),
      v_initial_message,
      new.created_at
    );

  end if;


  return new;

end;
$$;


drop trigger if exists
orders_create_service_conversation
on public.orders;


create trigger
orders_create_service_conversation
after insert
on public.orders
for each row
execute function
public.birdshop_create_service_conversation();


-- =========================================================
-- BACKFILL EXISTING SERVICE ORDERS
-- =========================================================

insert into public.service_conversations (
  order_id
)
select
  o.id
from public.orders o
where o.order_type = 'service'
on conflict (order_id)
do nothing;


-- =========================================================
-- BACKFILL EXISTING CUSTOMER REQUEST AS FIRST MESSAGE
-- =========================================================

insert into public.service_messages (
  conversation_id,
  sender_type,
  sender_label,
  body,
  created_at
)
select
  c.id,

  'customer',

  coalesce(
    nullif(
      trim(o.customer_name),
      ''
    ),
    'Customer'
  ),

  coalesce(
    nullif(
      trim(o.service_request_message),
      ''
    ),

    nullif(
      trim(o.notes),
      ''
    )
  ),

  o.created_at

from public.service_conversations c

join public.orders o
  on o.id = c.order_id

where o.order_type = 'service'

  and coalesce(
    nullif(
      trim(o.service_request_message),
      ''
    ),

    nullif(
      trim(o.notes),
      ''
    )
  ) is not null

  and not exists (
    select 1
    from public.service_messages m
    where m.conversation_id = c.id
  );


-- =========================================================
-- RLS
-- =========================================================

alter table public.service_conversations
enable row level security;

alter table public.service_messages
enable row level security;


revoke all
on table public.service_conversations
from anon,
authenticated;


revoke all
on table public.service_messages
from anon,
authenticated;


grant select,
update
on table public.service_conversations
to authenticated;


grant select
on table public.service_messages
to authenticated;


drop policy if exists
"BirdShop admins can read service conversations"
on public.service_conversations;


drop policy if exists
"BirdShop admins can update service conversations"
on public.service_conversations;


drop policy if exists
"BirdShop admins can read service messages"
on public.service_messages;


create policy
"BirdShop admins can read service conversations"
on public.service_conversations
for select
to authenticated
using (
  public.is_birdshop_admin()
);


create policy
"BirdShop admins can update service conversations"
on public.service_conversations
for update
to authenticated
using (
  public.is_birdshop_admin()
)
with check (
  public.is_birdshop_admin()
);


create policy
"BirdShop admins can read service messages"
on public.service_messages
for select
to authenticated
using (
  public.is_birdshop_admin()
);


-- =========================================================
-- TEMPORARY CUSTOMER CHAT ENTRY
--
-- Before Stripe/checkout exists, customers may enter:
--
--   order reference
--   exact contact used on the request
--
-- Once checkout exists, BirdShop will give the customer
-- their secure token automatically and this entry screen
-- becomes only a recovery method.
-- =========================================================

create or replace function
public.birdshop_open_service_chat(
  p_reference text,
  p_contact text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_contact text;
begin

  v_contact :=
    lower(
      trim(
        coalesce(
          p_contact,
          ''
        )
      )
    );


  if trim(
    coalesce(
      p_reference,
      ''
    )
  ) = '' then
    raise exception
      'Order reference is required.';
  end if;


  if length(v_contact) < 2 then
    raise exception
      'Contact information is required.';
  end if;


  select
    c.public_token
  into
    v_token

  from public.service_conversations c

  join public.orders o
    on o.id = c.order_id

  where upper(
    trim(o.reference)
  ) = upper(
    trim(p_reference)
  )

    and o.order_type =
      'service'

    and o.deleted_at
      is null

    and (
      v_contact =
        lower(
          trim(
            coalesce(
              o.customer_contact,
              ''
            )
          )
        )

      or v_contact =
        lower(
          trim(
            coalesce(
              o.customer_email,
              ''
            )
          )
        )

      or v_contact =
        lower(
          trim(
            coalesce(
              o.service_contact_handle,
              ''
            )
          )
        )
    )

  limit 1;


  if v_token is null then
    raise exception
      'We could not verify that service order.';
  end if;


  return v_token;

end;
$$;


-- =========================================================
-- GET CUSTOMER CHAT
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
-- CUSTOMER SEND MESSAGE
-- =========================================================

create or replace function
public.birdshop_send_service_chat_message(
  p_token text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_customer_name text;
  v_message_id uuid;
  v_recent_count integer;
begin

  if length(
    trim(
      coalesce(
        p_body,
        ''
      )
    )
  ) < 1 then
    raise exception
      'Message cannot be empty.';
  end if;


  if length(
    trim(p_body)
  ) > 4000 then
    raise exception
      'Message is too long.';
  end if;


  select
    c.id,
    o.customer_name

  into
    v_conversation_id,
    v_customer_name

  from public.service_conversations c

  join public.orders o
    on o.id = c.order_id

  where c.public_token =
    trim(p_token)

    and c.status =
      'open'

    and c.deleted_at
      is null

    and o.deleted_at
      is null

  limit 1;


  if v_conversation_id is null then
    raise exception
      'This conversation is unavailable.';
  end if;


  select
    count(*)

  into
    v_recent_count

  from public.service_messages

  where conversation_id =
    v_conversation_id

    and sender_type =
      'customer'

    and created_at >
      now() - interval '1 minute';


  if v_recent_count >= 10 then
    raise exception
      'Too many messages were sent. Please wait a moment.';
  end if;


  insert into public.service_messages (
    conversation_id,
    sender_type,
    sender_label,
    body
  )
  values (
    v_conversation_id,
    'customer',
    coalesce(
      nullif(
        trim(v_customer_name),
        ''
      ),
      'Customer'
    ),
    trim(p_body)
  )

  returning id
  into v_message_id;


  return v_message_id;

end;
$$;


-- =========================================================
-- ADMIN SEND MESSAGE
-- =========================================================

create or replace function
public.birdshop_admin_send_service_chat_message(
  p_conversation_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
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


  if length(
    trim(
      coalesce(
        p_body,
        ''
      )
    )
  ) < 1 then
    raise exception
      'Message cannot be empty.';
  end if;


  if length(
    trim(p_body)
  ) > 4000 then
    raise exception
      'Message is too long.';
  end if;


  if not exists (
    select 1
    from public.service_conversations
    where id =
      p_conversation_id

      and status =
        'open'

      and deleted_at
        is null
  ) then
    raise exception
      'Conversation is unavailable.';
  end if;


  insert into public.service_messages (
    conversation_id,
    sender_type,
    sender_label,
    body
  )
  values (
    p_conversation_id,
    'admin',
    'BirdShop',
    trim(p_body)
  )

  returning id
  into v_message_id;


  return v_message_id;

end;
$$;


-- =========================================================
-- RPC PERMISSIONS
-- =========================================================

revoke all
on function public.birdshop_open_service_chat(
  text,
  text
)
from public;


grant execute
on function public.birdshop_open_service_chat(
  text,
  text
)
to anon,
authenticated;


revoke all
on function public.birdshop_get_service_chat(text)
from public;


grant execute
on function public.birdshop_get_service_chat(text)
to anon,
authenticated;


revoke all
on function public.birdshop_send_service_chat_message(
  text,
  text
)
from public;


grant execute
on function public.birdshop_send_service_chat_message(
  text,
  text
)
to anon,
authenticated;


revoke all
on function public.birdshop_admin_send_service_chat_message(
  uuid,
  text
)
from public;


grant execute
on function public.birdshop_admin_send_service_chat_message(
  uuid,
  text
)
to authenticated,
service_role;


notify pgrst, 'reload schema';