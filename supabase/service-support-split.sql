-- =========================================================
-- BIRDSHOP
-- SERVICE / SUPPORT SPLIT
--
-- Service Request:
--   Website -> Orders -> Service Queue
--
-- Product Help + General Support:
--   Website -> Support Requests
--
-- This also prepares service orders for the upcoming
-- BirdShop chat + custom quote system.
-- =========================================================


-- =========================================================
-- SERVICE ORDER INTAKE FIELDS
-- =========================================================

alter table public.orders
add column if not exists package_id text;

alter table public.orders
add column if not exists service_request_message text;

alter table public.orders
add column if not exists service_contact_handle text;

alter table public.orders
add column if not exists chat_context jsonb
not null
default '{}'::jsonb;


-- =========================================================
-- EXPANDED SERVICE WORKFLOW
--
-- Some of these statuses are not used by the current Admin
-- UI yet. They are being added now so the upcoming chat /
-- custom quote system does not require another redesign.
-- =========================================================

alter table public.orders
drop constraint if exists orders_service_status_check;

alter table public.orders
add constraint orders_service_status_check
check (
  service_status is null
  or service_status in (
    'new',
    'discussing',
    'quote_sent',
    'awaiting_payment',
    'assigned',
    'in_progress',
    'waiting_customer',
    'customer_replied',
    'completed',
    'cancelled'
  )
);


-- =========================================================
-- SUBMIT SUPPORT REQUEST
--
-- SAME RPC NAME / SAME ARGUMENTS.
--
-- This is intentional:
-- ContactClient.tsx does not need to be rewritten.
--
-- topic = service
--      -> public.orders
--
-- topic = product/general
--      -> public.support_requests
-- =========================================================

create or replace function public.submit_support_request(
  p_topic text,
  p_display_name text,
  p_contact_handle text,
  p_message text,
  p_general_subject text default null,
  p_order_reference text default null,
  p_service_slug text default null,
  p_service_name text default null,
  p_package_id text default null,
  p_package_name text default null,
  p_package_price numeric default null,
  p_product_slug text default null,
  p_product_name text default null,
  p_product_platform text default null,
  p_product_region text default null,
  p_chat_context jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference text;
  v_customer_name text;
  v_safe_chat_context jsonb;
begin

  -- =======================================================
  -- BASIC VALIDATION
  -- =======================================================

  if p_topic not in (
    'service',
    'product',
    'general'
  ) then
    raise exception
      'Unsupported request type.';
  end if;


  if length(
    trim(
      coalesce(
        p_contact_handle,
        ''
      )
    )
  ) < 2 then
    raise exception
      'Contact information is required.';
  end if;


  if length(
    trim(
      coalesce(
        p_message,
        ''
      )
    )
  ) < 5 then
    raise exception
      'Please provide a little more detail.';
  end if;


  if
    length(
      coalesce(
        p_contact_handle,
        ''
      )
    ) > 240

    or length(
      coalesce(
        p_display_name,
        ''
      )
    ) > 120

    or length(
      coalesce(
        p_message,
        ''
      )
    ) > 6000

    or length(
      coalesce(
        p_general_subject,
        ''
      )
    ) > 180

    or length(
      coalesce(
        p_order_reference,
        ''
      )
    ) > 180

    or length(
      coalesce(
        p_chat_context,
        '{}'::jsonb
      )::text
    ) > 4000
  then
    raise exception
      'One or more fields are too long.';
  end if;


  v_safe_chat_context :=
    case
      when jsonb_typeof(
        coalesce(
          p_chat_context,
          '{}'::jsonb
        )
      ) = 'object'
      then coalesce(
        p_chat_context,
        '{}'::jsonb
      )

      else '{}'::jsonb
    end;


  v_customer_name :=
    coalesce(
      nullif(
        trim(
          coalesce(
            p_display_name,
            ''
          )
        ),
        ''
      ),

      nullif(
        trim(
          coalesce(
            p_contact_handle,
            ''
          )
        ),
        ''
      ),

      'BirdShop Customer'
    );


  -- =======================================================
  -- SERVICE REQUEST
  --
  -- Service work belongs in ORDERS / SERVICE QUEUE.
  -- It is NOT inserted into support_requests.
  -- =======================================================

  if p_topic = 'service' then

    if trim(
      coalesce(
        p_service_name,
        ''
      )
    ) = '' then
      raise exception
        'Choose a service before submitting.';
    end if;


    if
      p_package_price is not null
      and p_package_price < 0
    then
      raise exception
        'Service price cannot be negative.';
    end if;


    insert into public.orders (
      reference,

      customer_name,
      customer_email,
      customer_contact,

      order_type,

      service_slug,
      service_name,

      package_id,
      package_name,
      package_price,

      service_status,

      order_status,
      payment_status,
      fulfillment_status,

      currency,

      subtotal,
      discount_total,
      tax_total,
      total,

      source,

      notes,

      service_request_message,
      service_contact_handle,
      chat_context
    )
    values (
      '',

      v_customer_name,

      /*
       * The existing orders schema currently requires this
       * field to be non-null.
       *
       * Until checkout requires a dedicated email field,
       * BirdShop keeps the submitted contact handle here
       * as well as customer_contact.
       */
      trim(
        p_contact_handle
      ),

      trim(
        p_contact_handle
      ),

      'service',

      nullif(
        trim(
          coalesce(
            p_service_slug,
            ''
          )
        ),
        ''
      ),

      trim(
        p_service_name
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

      p_package_price,

      case
        when p_package_price is null
          then 'discussing'
        else 'new'
      end,

      'pending',
      'pending',
      'unfulfilled',

      'USD',

      coalesce(
        p_package_price,
        0
      ),

      0,
      0,

      coalesce(
        p_package_price,
        0
      ),

      'website_service_request',

      trim(
        p_message
      ),

      trim(
        p_message
      ),

      trim(
        p_contact_handle
      ),

      v_safe_chat_context
    )

    returning reference
    into v_reference;


    return v_reference;

  end if;


  -- =======================================================
  -- PRODUCT HELP / GENERAL SUPPORT
  --
  -- These remain normal support tickets.
  -- =======================================================

  insert into public.support_requests (
    topic,
    status,

    display_name,
    contact_handle,
    message,

    general_subject,
    order_reference,

    service_slug,
    service_name,
    package_id,
    package_name,
    package_price,

    product_slug,
    product_name,
    product_platform,
    product_region,

    source,
    chat_context
  )
  values (
    p_topic,

    'open',

    nullif(
      trim(
        coalesce(
          p_display_name,
          ''
        )
      ),
      ''
    ),

    trim(
      p_contact_handle
    ),

    trim(
      p_message
    ),

    case
      when p_topic = 'general'
      then nullif(
        trim(
          coalesce(
            p_general_subject,
            ''
          )
        ),
        ''
      )

      else null
    end,

    nullif(
      trim(
        coalesce(
          p_order_reference,
          ''
        )
      ),
      ''
    ),

    null,
    null,
    null,
    null,
    null,

    case
      when p_topic = 'product'
      then nullif(
        trim(
          coalesce(
            p_product_slug,
            ''
          )
        ),
        ''
      )

      else null
    end,

    case
      when p_topic = 'product'
      then nullif(
        trim(
          coalesce(
            p_product_name,
            ''
          )
        ),
        ''
      )

      else null
    end,

    case
      when p_topic = 'product'
      then nullif(
        trim(
          coalesce(
            p_product_platform,
            ''
          )
        ),
        ''
      )

      else null
    end,

    case
      when p_topic = 'product'
      then nullif(
        trim(
          coalesce(
            p_product_region,
            ''
          )
        ),
        ''
      )

      else null
    end,

    'website',

    v_safe_chat_context
  )

  returning reference
  into v_reference;


  return v_reference;

end;
$$;


-- =========================================================
-- PERMISSIONS
-- =========================================================

revoke all
on function public.submit_support_request(
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
  numeric,
  text,
  text,
  text,
  text,
  jsonb
)
from public;


grant execute
on function public.submit_support_request(
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
  numeric,
  text,
  text,
  text,
  text,
  jsonb
)
to anon,
authenticated;


-- =========================================================
-- REFRESH POSTGREST SCHEMA CACHE
-- =========================================================

notify pgrst, 'reload schema';