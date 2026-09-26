-- =========================================================
-- BIRDSHOP
-- CHAT-FIRST ARCHITECTURE FOUNDATION
--
-- PHASE 1
--
-- This prepares BirdShop for:
--
--   Conversation
--        ↓
--   Discussion / Quote
--        ↓
--   Payment
--        ↓
--   Order
--
-- IMPORTANT:
-- This migration intentionally DOES NOT disable the current
-- order -> conversation trigger yet.
--
-- The existing live website can continue working while the
-- new frontend/API code is prepared.
-- =========================================================


create extension if not exists pgcrypto;


-- =========================================================
-- SHARED REFERENCE SEQUENCE
--
-- Conversations and eventual orders can share the same
-- BS-###### reference.
--
-- Existing product/service order references already use
-- this sequence.
-- =========================================================

create sequence if not exists
public.birdshop_order_reference_seq
start with 100001;


-- =========================================================
-- CONVERSATION MODEL
--
-- Keep the existing table name for compatibility with the
-- current BirdShop code, but allow it to function as the
-- universal conversation table going forward.
-- =========================================================

alter table public.service_conversations
add column if not exists reference text;

alter table public.service_conversations
add column if not exists conversation_type text
not null default 'service';

alter table public.service_conversations
add column if not exists workflow_status text
not null default 'new';

alter table public.service_conversations
add column if not exists customer_name text;

alter table public.service_conversations
add column if not exists customer_email text;

alter table public.service_conversations
add column if not exists customer_contact text;

alter table public.service_conversations
add column if not exists subject text;

alter table public.service_conversations
add column if not exists request_message text;

alter table public.service_conversations
add column if not exists service_slug text;

alter table public.service_conversations
add column if not exists service_name text;

alter table public.service_conversations
add column if not exists package_id text;

alter table public.service_conversations
add column if not exists package_name text;

alter table public.service_conversations
add column if not exists product_slug text;

alter table public.service_conversations
add column if not exists product_name text;

alter table public.service_conversations
add column if not exists product_platform text;

alter table public.service_conversations
add column if not exists product_region text;

alter table public.service_conversations
add column if not exists assigned_to text;

alter table public.service_conversations
add column if not exists assigned_at timestamptz;

alter table public.service_conversations
add column if not exists linked_order_at timestamptz;

alter table public.service_conversations
add column if not exists source text
not null default 'website';


-- =========================================================
-- CONVERSATION TYPE
-- =========================================================

alter table public.service_conversations
drop constraint if exists
service_conversations_conversation_type_check;

alter table public.service_conversations
add constraint
service_conversations_conversation_type_check
check (
  conversation_type in (
    'service',
    'product',
    'general'
  )
);


-- =========================================================
-- WORKFLOW STATUS
--
-- Separate from:
--
-- status = open / closed
--
-- workflow_status tells us where the conversation is in
-- the actual support/service process.
-- =========================================================

alter table public.service_conversations
drop constraint if exists
service_conversations_workflow_status_check;

alter table public.service_conversations
add constraint
service_conversations_workflow_status_check
check (
  workflow_status in (
    'new',
    'discussing',
    'waiting_customer',
    'payment_pending',
    'paid',
    'in_progress',
    'completed',
    'cancelled'
  )
);


-- =========================================================
-- ORDER ID IS NOW OPTIONAL
--
-- This is the critical architecture change.
--
-- BEFORE:
--
-- conversation MUST have order
--
-- AFTER:
--
-- conversation may exist without order
--
-- order is attached later after payment.
-- =========================================================

alter table public.service_conversations
alter column order_id
drop not null;


-- =========================================================
-- CHANGE ORDER RELATIONSHIP
--
-- Previously deleting an order deleted the conversation.
--
-- Conversations should now survive independently.
-- =========================================================

alter table public.service_conversations
drop constraint if exists
service_conversations_order_id_fkey;

alter table public.service_conversations
add constraint
service_conversations_order_id_fkey
foreign key (
  order_id
)
references public.orders(id)
on delete set null;


-- =========================================================
-- BACKFILL EXISTING CONVERSATIONS
--
-- Copy information that currently lives only inside orders
-- into the conversation itself.
--
-- Existing conversations remain fully usable.
-- =========================================================

update public.service_conversations c
set
  reference =
    coalesce(
      nullif(
        trim(c.reference),
        ''
      ),
      o.reference
    ),

  customer_name =
    coalesce(
      nullif(
        trim(c.customer_name),
        ''
      ),
      o.customer_name
    ),

  customer_email =
    coalesce(
      nullif(
        trim(c.customer_email),
        ''
      ),
      nullif(
        trim(o.customer_email),
        ''
      )
    ),

  customer_contact =
    coalesce(
      nullif(
        trim(c.customer_contact),
        ''
      ),
      nullif(
        trim(o.service_contact_handle),
        ''
      ),
      nullif(
        trim(o.customer_contact),
        ''
      )
    ),

  service_name =
    coalesce(
      nullif(
        trim(c.service_name),
        ''
      ),
      o.service_name
    ),

  package_name =
    coalesce(
      nullif(
        trim(c.package_name),
        ''
      ),
      o.package_name
    ),

  request_message =
    coalesce(
      nullif(
        trim(c.request_message),
        ''
      ),
      nullif(
        trim(o.service_request_message),
        ''
      ),
      nullif(
        trim(o.notes),
        ''
      )
    ),

  subject =
    coalesce(
      nullif(
        trim(c.subject),
        ''
      ),
      nullif(
        trim(o.service_name),
        ''
      ),
      'Service Request'
    ),

  conversation_type =
    'service',

  linked_order_at =
    coalesce(
      c.linked_order_at,
      o.created_at
    ),

  workflow_status =
    case
      when o.service_status = 'completed'
        then 'completed'

      when o.service_status = 'cancelled'
        then 'cancelled'

      when o.service_status = 'waiting_customer'
        then 'waiting_customer'

      when o.service_status = 'in_progress'
        then 'in_progress'

      when o.payment_status = 'paid'
        then 'paid'

      else
        coalesce(
          c.workflow_status,
          'discussing'
        )
    end

from public.orders o

where
  c.order_id = o.id;


-- =========================================================
-- GIVE ANY UNLINKED / LEGACY CHAT A REFERENCE
-- =========================================================

update public.service_conversations
set
  reference =
    'BS-' ||
    nextval(
      'public.birdshop_order_reference_seq'
    )::text

where
  reference is null
  or trim(reference) = '';


-- =========================================================
-- REFERENCE MUST NOW EXIST
-- =========================================================

alter table public.service_conversations
alter column reference
set not null;


create unique index if not exists
service_conversations_reference_unique_idx
on public.service_conversations(
  reference
);


-- =========================================================
-- REFERENCE TRIGGER
--
-- If a conversation is created from an existing order,
-- preserve that order's BS reference.
--
-- Otherwise create a fresh BS reference.
-- =========================================================

create or replace function
public.birdshop_assign_conversation_reference()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_order_reference text;
begin

  if
    new.reference is null
    or trim(new.reference) = ''
  then

    if new.order_id is not null then

      select
        reference
      into
        v_order_reference

      from public.orders

      where id =
        new.order_id;

    end if;


    if
      v_order_reference is not null
      and trim(v_order_reference) <> ''
    then

      new.reference :=
        v_order_reference;

    else

      new.reference :=
        'BS-' ||
        nextval(
          'public.birdshop_order_reference_seq'
        )::text;

    end if;

  end if;


  return new;

end;
$$;


drop trigger if exists
service_conversations_assign_reference
on public.service_conversations;


create trigger
service_conversations_assign_reference
before insert
on public.service_conversations
for each row
execute function
public.birdshop_assign_conversation_reference();


-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists
service_conversations_type_idx
on public.service_conversations(
  conversation_type
);


create index if not exists
service_conversations_workflow_idx
on public.service_conversations(
  workflow_status
);


create index if not exists
service_conversations_customer_email_idx
on public.service_conversations(
  lower(customer_email)
);


create index if not exists
service_conversations_active_idx
on public.service_conversations(
  conversation_type,
  status,
  last_message_at desc
)
where deleted_at is null;


create index if not exists
service_conversations_order_nullable_idx
on public.service_conversations(
  order_id
)
where order_id is not null;


-- =========================================================
-- PAYMENT REQUESTS
--
-- Payment requests also need to be allowed BEFORE an order
-- exists.
--
-- If the table exists in the current BirdShop database,
-- make order_id nullable and preserve the payment request
-- even if an order is removed.
-- =========================================================

do $$
declare
  v_constraint record;
begin

  if
    to_regclass(
      'public.service_payment_requests'
    )
    is not null
  then

    execute
      'alter table public.service_payment_requests
       alter column order_id drop not null';


    for v_constraint in

      select
        conname

      from pg_constraint

      where
        conrelid =
          'public.service_payment_requests'::regclass

        and confrelid =
          'public.orders'::regclass

        and contype = 'f'

    loop

      execute format(
        'alter table public.service_payment_requests
         drop constraint %I',
        v_constraint.conname
      );

    end loop;


    execute
      'alter table public.service_payment_requests
       add constraint
       service_payment_requests_order_id_fkey
       foreign key (order_id)
       references public.orders(id)
       on delete set null';

  end if;

end;
$$;


-- =========================================================
-- UNIVERSAL CONVERSATION CREATION RPC
--
-- This is the new foundation for:
--
-- service
-- product support
-- general support
--
-- IMPORTANT:
-- The frontend does NOT use this yet.
--
-- We will switch ContactClient to this after the Admin and
-- customer chat code can safely handle order_id = null.
-- =========================================================

create or replace function
public.birdshop_create_conversation(
  p_conversation_type text,
  p_customer_name text,
  p_customer_email text,
  p_customer_contact text,
  p_subject text,
  p_message text,

  p_service_slug text,
  p_service_name text,
  p_package_id text,
  p_package_name text,

  p_product_slug text,
  p_product_name text,
  p_product_platform text,
  p_product_region text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;

  v_name text;

  v_email text;

  v_contact text;

  v_subject text;

  v_message text;

  v_recent_count integer;

  v_conversation_id uuid;

  v_reference text;

  v_token text;
begin

  -- =======================================================
  -- NORMALIZE
  -- =======================================================

  v_type :=
    lower(
      trim(
        coalesce(
          p_conversation_type,
          ''
        )
      )
    );


  v_name :=
    nullif(
      trim(
        coalesce(
          p_customer_name,
          ''
        )
      ),
      ''
    );


  v_email :=
    lower(
      trim(
        coalesce(
          p_customer_email,
          ''
        )
      )
    );


  v_contact :=
    nullif(
      trim(
        coalesce(
          p_customer_contact,
          ''
        )
      ),
      ''
    );


  v_subject :=
    nullif(
      trim(
        coalesce(
          p_subject,
          ''
        )
      ),
      ''
    );


  v_message :=
    trim(
      coalesce(
        p_message,
        ''
      )
    );


  -- =======================================================
  -- TYPE VALIDATION
  -- =======================================================

  if
    v_type not in (
      'service',
      'product',
      'general'
    )
  then

    raise exception
      'Choose a valid BirdShop conversation type.';

  end if;


  -- =======================================================
  -- EMAIL
  --
  -- New conversations require email because:
  --
  --   1. recovery uses reference + email
  --   2. automated emails need a destination
  -- =======================================================

  if
    char_length(v_email) < 5
    or char_length(v_email) > 320
  then

    raise exception
      'Enter a valid email address.';

  end if;


  if
    v_email !~
    '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then

    raise exception
      'Enter a valid email address.';

  end if;


  -- =======================================================
  -- CUSTOMER NAME
  -- =======================================================

  if
    v_name is not null
    and char_length(v_name) > 120
  then

    raise exception
      'Display name is too long.';

  end if;


  -- =======================================================
  -- OPTIONAL CONTACT
  -- =======================================================

  if
    v_contact is not null
    and char_length(v_contact) > 240
  then

    raise exception
      'Contact information is too long.';

  end if;


  -- =======================================================
  -- MESSAGE
  -- =======================================================

  if
    char_length(v_message) < 5
  then

    raise exception
      'Please add a little more detail to your request.';

  end if;


  if
    char_length(v_message) > 4000
  then

    raise exception
      'Messages cannot exceed 4000 characters.';

  end if;


  -- =======================================================
  -- SUBJECT
  -- =======================================================

  if
    v_subject is not null
    and char_length(v_subject) > 180
  then

    raise exception
      'Subject is too long.';

  end if;


  -- =======================================================
  -- TYPE-SPECIFIC VALIDATION
  -- =======================================================

  if
    v_type = 'service'
    and trim(
      coalesce(
        p_service_name,
        ''
      )
    ) = ''
  then

    raise exception
      'Choose a BirdShop service.';

  end if;


  if
    v_type = 'product'
    and trim(
      coalesce(
        p_product_name,
        ''
      )
    ) = ''
  then

    raise exception
      'Choose a BirdShop product.';

  end if;


  if
    v_type = 'general'
    and v_subject is null
  then

    raise exception
      'Add a subject for your support request.';

  end if;


  -- =======================================================
  -- BASIC ANTI-SPAM
  --
  -- No IP tracking is required.
  --
  -- Limit repeated conversation creation from the same
  -- email address.
  -- =======================================================

  select
    count(*)

  into
    v_recent_count

  from public.service_conversations

  where
    lower(
      coalesce(
        customer_email,
        ''
      )
    ) =
      v_email

    and created_at >
      now() -
      interval '30 minutes'

    and deleted_at
      is null;


  if
    v_recent_count >= 5
  then

    raise exception
      'Too many requests were created recently. Please wait before creating another conversation.';

  end if;


  -- =======================================================
  -- CREATE CHAT
  --
  -- NO ORDER IS CREATED HERE.
  -- =======================================================

  insert into public.service_conversations (
    order_id,

    conversation_type,

    workflow_status,

    customer_name,

    customer_email,

    customer_contact,

    subject,

    request_message,

    service_slug,

    service_name,

    package_id,

    package_name,

    product_slug,

    product_name,

    product_platform,

    product_region,

    status,

    source
  )
  values (
    null,

    v_type,

    'new',

    coalesce(
      v_name,
      'Customer'
    ),

    v_email,

    v_contact,

    coalesce(
      v_subject,

      case
        when v_type = 'service'
          then nullif(
            trim(
              p_service_name
            ),
            ''
          )

        when v_type = 'product'
          then nullif(
            trim(
              p_product_name
            ),
            ''
          )

        else
          'Support Request'
      end
    ),

    v_message,

    nullif(
      trim(
        coalesce(
          p_service_slug,
          ''
        )
      ),
      ''
    ),

    nullif(
      trim(
        coalesce(
          p_service_name,
          ''
        )
      ),
      ''
    ),

    nullif(
      trim(
        coalesce(
          p_package_id,
          ''
        )
      ),
      ''
    ),

    nullif(
      trim(
        coalesce(
          p_package_name,
          ''
        )
      ),
      ''
    ),

    nullif(
      trim(
        coalesce(
          p_product_slug,
          ''
        )
      ),
      ''
    ),

    nullif(
      trim(
        coalesce(
          p_product_name,
          ''
        )
      ),
      ''
    ),

    nullif(
      trim(
        coalesce(
          p_product_platform,
          ''
        )
      ),
      ''
    ),

    nullif(
      trim(
        coalesce(
          p_product_region,
          ''
        )
      ),
      ''
    ),

    'open',

    'website'
  )

  returning
    id,
    reference,
    public_token

  into
    v_conversation_id,
    v_reference,
    v_token;


  -- =======================================================
  -- FIRST CUSTOMER MESSAGE
  -- =======================================================

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
      v_name,
      'Customer'
    ),

    v_message
  );


  -- =======================================================
  -- RESULT
  -- =======================================================

  return jsonb_build_object(
    'conversation_id',
      v_conversation_id,

    'reference',
      v_reference,

    'public_token',
      v_token,

    'conversation_type',
      v_type
  );

end;
$$;


-- =========================================================
-- PUBLIC RPC PERMISSIONS
-- =========================================================

revoke all
on function
public.birdshop_create_conversation(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public;


grant execute
on function
public.birdshop_create_conversation(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to
  anon,
  authenticated;


-- =========================================================
-- UNIVERSAL RECOVERY RPC
--
-- Customer can later enter:
--
--   BS-######
--   email / exact contact
--
-- and recover the private chat.
-- =========================================================

create or replace function
public.birdshop_open_conversation(
  p_reference text,
  p_contact text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference text;

  v_contact text;

  v_token text;
begin

  v_reference :=
    upper(
      trim(
        coalesce(
          p_reference,
          ''
        )
      )
    );


  v_contact :=
    lower(
      trim(
        coalesce(
          p_contact,
          ''
        )
      )
    );


  if
    v_reference = ''
  then

    raise exception
      'Reference is required.';

  end if;


  if
    char_length(v_contact) < 2
  then

    raise exception
      'Email or contact information is required.';

  end if;


  select
    c.public_token

  into
    v_token

  from public.service_conversations c

  where
    upper(
      trim(
        c.reference
      )
    ) =
      v_reference

    and c.deleted_at
      is null

    and (
      v_contact =
        lower(
          trim(
            coalesce(
              c.customer_email,
              ''
            )
          )
        )

      or

      v_contact =
        lower(
          trim(
            coalesce(
              c.customer_contact,
              ''
            )
          )
        )
    )

  limit 1;


  if
    v_token is null
  then

    raise exception
      'We could not verify that BirdShop conversation.';

  end if;


  return v_token;

end;
$$;


revoke all
on function
public.birdshop_open_conversation(
  text,
  text
)
from public;


grant execute
on function
public.birdshop_open_conversation(
  text,
  text
)
to
  anon,
  authenticated;


-- =========================================================
-- KEEP OLD SERVICE RECOVERY WORKING
--
-- Existing customer code can continue calling:
--
-- birdshop_open_service_chat()
--
-- until we replace it in the frontend.
-- =========================================================

create or replace function
public.birdshop_open_service_chat(
  p_reference text,
  p_contact text
)
returns text
language sql
security definer
set search_path = public
as $$

  select
    public.birdshop_open_conversation(
      p_reference,
      p_contact
    );

$$;


revoke all
on function
public.birdshop_open_service_chat(
  text,
  text
)
from public;


grant execute
on function
public.birdshop_open_service_chat(
  text,
  text
)
to
  anon,
  authenticated;


-- =========================================================
-- ADMIN RLS
--
-- Public customers still receive NO direct table access.
--
-- Admin users may continue reading/updating conversations
-- through the existing BirdShop admin authorization.
-- =========================================================

alter table public.service_conversations
enable row level security;


alter table public.service_messages
enable row level security;


revoke all
on table public.service_conversations
from anon;


revoke all
on table public.service_messages
from anon;


-- =========================================================
-- POSTGREST SCHEMA REFRESH
-- =========================================================

notify pgrst,
'reload schema';