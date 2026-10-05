-- =========================================================
-- BIRDSHOP CUSTOM SERVICE QUOTES
--
-- Custom Quote submissions become REAL service orders.
--
-- Flow:
--   Contact -> Custom Quote
--   -> orders row
--   -> existing service-order trigger creates private chat
--   -> customer's request becomes the first chat message
--   -> function returns reference + private token
--   -> storefront redirects directly to /service-chat
--
-- IMPORTANT:
-- This function does NOT expose direct public table access.
-- Anonymous customers may execute only this validated
-- security-definer RPC.
-- =========================================================


create or replace function
public.birdshop_submit_custom_service_quote(
  p_customer_name text,
  p_customer_email text,
  p_service_name text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_name text;
  v_customer_email text;
  v_service_name text;
  v_message text;

  v_order_id uuid;
  v_reference text;
  v_token text;
begin

  /* =======================================================
     NORMALIZE
  ======================================================= */

  v_customer_name :=
    nullif(
      trim(
        coalesce(
          p_customer_name,
          ''
        )
      ),
      ''
    );

  v_customer_email :=
    lower(
      trim(
        coalesce(
          p_customer_email,
          ''
        )
      )
    );

  v_service_name :=
    trim(
      coalesce(
        p_service_name,
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


  /* =======================================================
     VALIDATION
  ======================================================= */

  if length(v_customer_email) < 5
     or position('@' in v_customer_email) <= 1
     or length(v_customer_email) > 320
  then
    raise exception
      'Enter a valid email address.';
  end if;


  if length(v_service_name) < 2
     or length(v_service_name) > 160
  then
    raise exception
      'Choose a valid BirdShop service.';
  end if;


  if length(v_message) < 5 then
    raise exception
      'Add a little more detail about your custom request.';
  end if;


  if length(v_message) > 4000 then
    raise exception
      'Custom request is too long.';
  end if;


  if v_customer_name is not null
     and length(v_customer_name) > 120
  then
    raise exception
      'Name is too long.';
  end if;


  /* =======================================================
     CREATE REAL SERVICE ORDER

     The existing BirdShop orders reference trigger assigns:
       BS-100001
       BS-100002
       ...

     The existing service-chat trigger sees:
       order_type = 'service'

     and automatically creates the private conversation.
  ======================================================= */

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
      v_customer_name,
      'Customer'
    ),

    v_customer_email,
    v_customer_email,

    'service',

    'pending',
    'pending',
    'unfulfilled',

    'USD',
    0,
    0,
    0,
    0,

    'custom_quote',

    v_service_name,
    'Custom',
    'discussing',

    v_message,
    v_customer_email
  )
  returning
    id,
    reference
  into
    v_order_id,
    v_reference;


  /* =======================================================
     GET PRIVATE CHAT TOKEN

     orders_create_service_conversation is an AFTER INSERT
     trigger, so the conversation exists before execution
     continues here.
  ======================================================= */

  select
    c.public_token
  into
    v_token
  from public.service_conversations c
  where c.order_id =
    v_order_id
  limit 1;


  if v_token is null then
    raise exception
      'BirdShop could not create the private service chat.';
  end if;


  /* =======================================================
     RESULT
  ======================================================= */

  return jsonb_build_object(
    'reference',
      v_reference,

    'token',
      v_token
  );

end;
$$;


-- =========================================================
-- PERMISSIONS
-- =========================================================

revoke all
on function
public.birdshop_submit_custom_service_quote(
  text,
  text,
  text,
  text
)
from public;


grant execute
on function
public.birdshop_submit_custom_service_quote(
  text,
  text,
  text,
  text
)
to anon,
authenticated;


notify pgrst, 'reload schema';
