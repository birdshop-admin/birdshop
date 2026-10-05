
-- =========================================================
-- BIRDSHOP
-- CHAT-FIRST CUSTOMER RPCs
--
-- PHASE 2
--
-- Makes the private chat work whether:
--
--   order_id = NULL
--
-- or
--
--   order_id = existing paid/order record
--
-- Existing frontend routes can keep calling:
--
--   birdshop_open_service_chat()
--   birdshop_get_service_chat()
--   birdshop_send_service_chat_message()
--
-- so we do not have to switch the UI yet.
-- =========================================================


-- =========================================================
-- GET PRIVATE CHAT
--
-- Conversation data is now the primary source.
--
-- Order data is OPTIONAL and only supplements the chat
-- after an order has eventually been created/linked.
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
  v_token text;

  v_conversation_id uuid;

  v_result jsonb;
begin

  -- =======================================================
  -- TOKEN
  -- =======================================================

  v_token :=
    trim(
      coalesce(
        p_token,
        ''
      )
    );


  if
    char_length(v_token) < 20
  then

    raise exception
      'Conversation not found.';

  end if;


  -- =======================================================
  -- VERIFY CONVERSATION
  --
  -- IMPORTANT:
  -- No order JOIN here.
  -- =======================================================

  select
    c.id

  into
    v_conversation_id

  from public.service_conversations c

  where
    c.public_token =
      v_token

    and c.deleted_at
      is null

  limit 1;


  if
    v_conversation_id is null
  then

    raise exception
      'Conversation not found.';

  end if;


  -- =======================================================
  -- CUSTOMER READ STATE
  -- =======================================================

  update public.service_conversations

  set
    customer_last_read_at =
      now()

  where
    id =
      v_conversation_id;


  -- =======================================================
  -- CHAT PAYLOAD
  --
  -- LEFT JOIN ORDERS because a conversation may not have
  -- an order until after payment.
  -- =======================================================

  select

    jsonb_build_object(

      -- ---------------------------------------------------
      -- CONVERSATION
      -- ---------------------------------------------------

      'conversation_id',
        c.id,

      'reference',
        c.reference,

      'conversation_type',
        c.conversation_type,

      'workflow_status',
        c.workflow_status,

      'conversation_status',
        c.status,

      'subject',
        c.subject,


      -- ---------------------------------------------------
      -- CUSTOMER
      -- ---------------------------------------------------

      'customer_name',
        coalesce(
          nullif(
            trim(
              c.customer_name
            ),
            ''
          ),

          nullif(
            trim(
              o.customer_name
            ),
            ''
          ),

          'Customer'
        ),

      'customer_email',
        coalesce(
          nullif(
            trim(
              c.customer_email
            ),
            ''
          ),

          nullif(
            trim(
              o.customer_email
            ),
            ''
          )
        ),

      'customer_contact',
        coalesce(
          nullif(
            trim(
              c.customer_contact
            ),
            ''
          ),

          nullif(
            trim(
              o.customer_contact
            ),
            ''
          )
        ),


      -- ---------------------------------------------------
      -- SERVICE
      -- ---------------------------------------------------

      'service_name',
        coalesce(
          nullif(
            trim(
              c.service_name
            ),
            ''
          ),

          nullif(
            trim(
              o.service_name
            ),
            ''
          )
        ),

      'package_name',
        coalesce(
          nullif(
            trim(
              c.package_name
            ),
            ''
          ),

          nullif(
            trim(
              o.package_name
            ),
            ''
          )
        ),


      -- ---------------------------------------------------
      -- PRODUCT SUPPORT
      -- ---------------------------------------------------

      'product_name',
        c.product_name,

      'product_platform',
        c.product_platform,

      'product_region',
        c.product_region,


      -- ---------------------------------------------------
      -- ORDER
      --
      -- These remain NULL / default until a real order
      -- exists.
      -- ---------------------------------------------------

      'order_id',
        c.order_id,

      'order_reference',
        o.reference,

      'total',
        coalesce(
          o.total,
          0
        ),

      'payment_status',

        case

          when
            o.payment_status is not null
          then
            o.payment_status


          when exists (
            select 1

            from public.service_payment_requests pr

            where
              pr.conversation_id =
                c.id

              and pr.status =
                'paid'
          )
          then
            'paid'


          when exists (
            select 1

            from public.service_payment_requests pr

            where
              pr.conversation_id =
                c.id

              and pr.status =
                'pending'
          )
          then
            'pending'


          else
            'not_requested'

        end,

      'service_status',
        coalesce(
          o.service_status,
          c.workflow_status
        ),


      -- ---------------------------------------------------
      -- MESSAGES
      -- ---------------------------------------------------

      'messages',

        coalesce(

          (
            select

              jsonb_agg(

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
                    coalesce(
                      m.message_type,
                      'text'
                    ),

                  'metadata',
                    coalesce(
                      m.metadata,
                      '{}'::jsonb
                    ),

                  'created_at',
                    m.created_at

                )

                order by
                  m.created_at

              )

            from public.service_messages m

            where
              m.conversation_id =
                c.id

          ),

          '[]'::jsonb

        ),


      -- ---------------------------------------------------
      -- PAYMENT REQUESTS
      --
      -- These can exist before an Order now.
      -- ---------------------------------------------------

      'payment_requests',

        coalesce(

          (
            select

              jsonb_agg(

                jsonb_build_object(

                  'id',
                    pr.id,

                  'amount',
                    pr.amount,

                  'currency',
                    pr.currency,

                  'title',
                    pr.title,

                  'description',
                    pr.description,

                  'status',
                    pr.status,

                  'created_at',
                    pr.created_at,

                  'paid_at',
                    pr.paid_at

                )

                order by
                  pr.created_at

              )

            from public.service_payment_requests pr

            where
              pr.conversation_id =
                c.id

          ),

          '[]'::jsonb

        )

    )

  into
    v_result

  from public.service_conversations c

  left join public.orders o

    on
      o.id =
        c.order_id

    and
      o.deleted_at
        is null

  where
    c.id =
      v_conversation_id;


  return
    v_result;

end;
$$;


-- =========================================================
-- CUSTOMER SEND MESSAGE
--
-- No order is required anymore.
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
  v_token text;

  v_body text;

  v_conversation_id uuid;

  v_customer_name text;

  v_message_id uuid;

  v_recent_count integer;
begin

  -- =======================================================
  -- NORMALIZE
  -- =======================================================

  v_token :=
    trim(
      coalesce(
        p_token,
        ''
      )
    );


  v_body :=
    trim(
      coalesce(
        p_body,
        ''
      )
    );


  -- =======================================================
  -- MESSAGE VALIDATION
  -- =======================================================

  if
    char_length(v_body) < 1
  then

    raise exception
      'Message cannot be empty.';

  end if;


  if
    char_length(v_body) > 4000
  then

    raise exception
      'Message is too long.';

  end if;


  -- =======================================================
  -- LOAD CONVERSATION
  --
  -- IMPORTANT:
  -- No order JOIN.
  -- =======================================================

  select
    c.id,

    coalesce(
      nullif(
        trim(
          c.customer_name
        ),
        ''
      ),
      'Customer'
    )

  into
    v_conversation_id,
    v_customer_name

  from public.service_conversations c

  where
    c.public_token =
      v_token

    and c.status =
      'open'

    and c.deleted_at
      is null

  limit 1;


  if
    v_conversation_id is null
  then

    raise exception
      'This conversation is unavailable.';

  end if;


  -- =======================================================
  -- RATE LIMIT
  --
  -- Maximum:
  -- 10 customer messages per minute per conversation.
  -- =======================================================

  select
    count(*)

  into
    v_recent_count

  from public.service_messages

  where
    conversation_id =
      v_conversation_id

    and sender_type =
      'customer'

    and created_at >
      now() -
      interval '1 minute';


  if
    v_recent_count >= 10
  then

    raise exception
      'Too many messages were sent. Please wait a moment.';

  end if;


  -- =======================================================
  -- INSERT MESSAGE
  -- =======================================================

  insert into public.service_messages (
    conversation_id,

    sender_type,

    sender_label,

    body,

    message_type,

    metadata
  )
  values (
    v_conversation_id,

    'customer',

    v_customer_name,

    v_body,

    'text',

    '{}'::jsonb
  )

  returning
    id

  into
    v_message_id;


  -- =======================================================
  -- WORKFLOW
  --
  -- First actual conversation activity moves a new request
  -- into discussion.
  -- =======================================================

  update public.service_conversations

  set
    workflow_status =

      case

        when workflow_status =
          'new'

        then
          'discussing'

        else
          workflow_status

      end,

    customer_last_read_at =
      now()

  where
    id =
      v_conversation_id;


  return
    v_message_id;

end;
$$;


-- =========================================================
-- ADMIN SEND MESSAGE
--
-- This already did not technically require an order, but
-- we rewrite it so its workflow behavior matches the new
-- chat-first architecture.
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
  v_body text;

  v_message_id uuid;
begin

  -- =======================================================
  -- AUTHORIZATION
  -- =======================================================

  if

    coalesce(
      auth.role(),
      ''
    ) <> 'service_role'

    and

    not public.is_birdshop_admin()

  then

    raise exception
      'Not authorized.';

  end if;


  -- =======================================================
  -- MESSAGE
  -- =======================================================

  v_body :=
    trim(
      coalesce(
        p_body,
        ''
      )
    );


  if
    char_length(v_body) < 1
  then

    raise exception
      'Message cannot be empty.';

  end if;


  if
    char_length(v_body) > 4000
  then

    raise exception
      'Message is too long.';

  end if;


  -- =======================================================
  -- CONVERSATION
  -- =======================================================

  if not exists (

    select 1

    from public.service_conversations

    where
      id =
        p_conversation_id

      and status =
        'open'

      and deleted_at
        is null

  )
  then

    raise exception
      'Conversation is unavailable.';

  end if;


  -- =======================================================
  -- INSERT
  -- =======================================================

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

    v_body,

    'text',

    '{}'::jsonb
  )

  returning
    id

  into
    v_message_id;


  -- =======================================================
  -- WORKFLOW
  -- =======================================================

  update public.service_conversations

  set
    workflow_status =

      case

        when workflow_status =
          'new'

        then
          'discussing'

        else
          workflow_status

      end,

    admin_last_read_at =
      now()

  where
    id =
      p_conversation_id;


  return
    v_message_id;

end;
$$;


-- =========================================================
-- RECOVERY
--
-- Keep both names available while the frontend migrates.
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


  return
    v_token;

end;
$$;


-- =========================================================
-- LEGACY NAME
--
-- Current API route can keep calling this.
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


-- =========================================================
-- PERMISSIONS
-- =========================================================

revoke all
on function
public.birdshop_get_service_chat(
  text
)
from public;


grant execute
on function
public.birdshop_get_service_chat(
  text
)
to
  anon,
  authenticated;


revoke all
on function
public.birdshop_send_service_chat_message(
  text,
  text
)
from public;


grant execute
on function
public.birdshop_send_service_chat_message(
  text,
  text
)
to
  anon,
  authenticated;


revoke all
on function
public.birdshop_admin_send_service_chat_message(
  uuid,
  text
)
from public;


grant execute
on function
public.birdshop_admin_send_service_chat_message(
  uuid,
  text
)
to
  authenticated,
  service_role;


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
-- REFRESH SUPABASE API SCHEMA
-- =========================================================

notify pgrst,
'reload schema';