-- =========================================================
-- BIRDSHOP
-- PUBLIC SERVICE REQUEST -> SERVICE ORDER
--
-- A website service request becomes a real BirdShop order.
--
-- Existing service-order triggers then automatically:
--   1. create the private service conversation
--   2. copy service_request_message into the conversation
--
-- Product Help / General Support do NOT use this function.
-- Reviews do NOT use this function.
-- =========================================================


-- =========================================================
-- REQUIRED SERVICE ORDER FIELDS
--
-- These are idempotent so this script is safe if some of
-- these fields already exist.
-- =========================================================

alter table public.orders
add column if not exists order_type text
not null default 'product';


alter table public.orders
add column if not exists service_name text;


alter table public.orders
add column if not exists package_name text;


alter table public.orders
add column if not exists service_status text;


alter table public.orders
add column if not exists assigned_to text;


alter table public.orders
add column if not exists archived_at timestamptz;


alter table public.orders
add column if not exists service_request_message text;


alter table public.orders
add column if not exists service_contact_handle text;


alter table public.orders
add column if not exists deleted_at timestamptz;


-- =========================================================
-- SERVICE REQUEST FUNCTION
-- =========================================================

create or replace function
public.submit_service_request(
  p_display_name text,
  p_contact_handle text,
  p_message text,
  p_service_slug text,
  p_service_name text,
  p_package_id text,
  p_package_name text,
  p_package_price numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare

  v_order_id uuid;

  v_reference text;

  v_name text;

  v_contact text;

  v_message text;

  v_service_name text;

  v_package_name text;

  v_price numeric(12, 2);

  v_email text;

begin

  -- =======================================================
  -- NORMALIZE
  -- =======================================================

  v_name :=
    nullif(
      trim(
        coalesce(
          p_display_name,
          ''
        )
      ),
      ''
    );


  v_contact :=
    trim(
      coalesce(
        p_contact_handle,
        ''
      )
    );


  v_message :=
    trim(
      coalesce(
        p_message,
        ''
      )
    );


  v_service_name :=
    trim(
      coalesce(
        p_service_name,
        ''
      )
    );


  v_package_name :=
    trim(
      coalesce(
        p_package_name,
        ''
      )
    );


  v_price :=
    round(
      greatest(
        coalesce(
          p_package_price,
          0
        ),
        0
      )::numeric,
      2
    );


  -- =======================================================
  -- VALIDATION
  -- =======================================================

  if char_length(v_contact) < 2 then

    raise exception
      'Enter your Discord username or email so BirdShop can contact you.';

  end if;


  if char_length(v_contact) > 320 then

    raise exception
      'Contact information is too long.';

  end if;


  if char_length(v_message) < 5 then

    raise exception
      'Please add a little more detail to your service request.';

  end if;


  if char_length(v_message) > 4000 then

    raise exception
      'Service requests cannot exceed 4000 characters.';

  end if;


  if v_service_name = '' then

    raise exception
      'Choose a BirdShop service before submitting.';

  end if;


  if char_length(v_service_name) > 200 then

    raise exception
      'Service name is too long.';

  end if;


  if char_length(v_package_name) > 200 then

    raise exception
      'Package name is too long.';

  end if;


  -- =======================================================
  -- EMAIL
  --
  -- customer_email currently exists as a required Orders
  -- field.
  --
  -- If the supplied contact looks like an email, preserve it
  -- there. Otherwise the real contact still lives safely in:
  --
  --   customer_contact
  --   service_contact_handle
  --
  -- =======================================================

  if
    position(
      '@' in v_contact
    ) > 1
  then

    v_email :=
      lower(
        v_contact
      );

  else

    v_email := '';

  end if;


  -- =======================================================
  -- CREATE SERVICE ORDER
  --
  -- reference intentionally starts blank.
  --
  -- The existing BirdShop order-reference trigger will
  -- assign:
  --
  --   BS-100001
  --   BS-100002
  --   ...
  --
  -- =======================================================

  insert into public.orders (

    reference,

    customer_name,

    customer_email,

    customer_contact,

    order_type,

    order_status,

    payment_status,

    fulfillment_status,

    currency,

    subtotal,

    discount_total,

    tax_total,

    total,

    source,

    service_name,

    package_name,

    service_status,

    service_request_message,

    service_contact_handle

  )

  values (

    '',

    coalesce(
      v_name,
      'Customer'
    ),

    v_email,

    v_contact,

    'service',

    'pending',

    'pending',

    'unfulfilled',

    'USD',

    v_price,

    0,

    0,

    v_price,

    'website_service_request',

    v_service_name,

    nullif(
      v_package_name,
      ''
    ),

    'new',

    v_message,

    v_contact

  )

  returning
    id,
    reference

  into
    v_order_id,
    v_reference;


  -- =======================================================
  -- SAFETY CHECK
  -- =======================================================

  if
    v_order_id is null
    or v_reference is null
    or trim(v_reference) = ''
  then

    raise exception
      'BirdShop could not create the service request.';

  end if;


  -- =======================================================
  -- RETURN CUSTOMER REFERENCE
  -- =======================================================

  return v_reference;

end;
$$;


-- =========================================================
-- PERMISSIONS
--
-- Customers must never receive direct write permission
-- to public.orders.
--
-- They may ONLY create the service order through this
-- controlled security-definer function.
-- =========================================================

revoke all
on function public.submit_service_request(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric
)
from public;


grant execute
on function public.submit_service_request(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric
)
to anon,
authenticated;


-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists
orders_order_type_idx
on public.orders(order_type);


create index if not exists
orders_service_status_idx
on public.orders(service_status);


create index if not exists
orders_service_created_idx
on public.orders(
  order_type,
  created_at desc
);


-- =========================================================
-- DONE
-- =========================================================