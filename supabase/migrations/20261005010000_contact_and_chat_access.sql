begin;

CREATE OR REPLACE FUNCTION public.birdshop_create_conversation(p_conversation_type text, p_customer_name text, p_customer_email text, p_customer_contact text, p_subject text, p_message text, p_service_slug text, p_service_name text, p_package_id text, p_package_name text, p_product_slug text, p_product_name text, p_product_platform text, p_product_region text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform private.birdshop_require_server();

  -- =======================================================
  -- NORMALIZE
  -- =======================================================

  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_customer_email)),0));

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
          case when v_type='service' then 'custom' else null end,
          ''
        )
      ),
      ''
    ),

    nullif(
      trim(
        coalesce(
          case when v_type='service' then 'Custom' else null end,
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
$function$;

revoke execute on function public.birdshop_create_conversation(text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;

grant execute on function public.birdshop_create_conversation(text,text,text,text,text,text,text,text,text,text,text,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.birdshop_send_service_chat_message(p_token text, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token text;

  v_body text;

  v_conversation_id uuid;

  v_customer_name text;

  v_message_id uuid;

  v_recent_count integer;
begin
  perform private.birdshop_require_server();

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

  limit 1 for update;


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
$function$;

revoke execute on function public.birdshop_send_service_chat_message(text,text) from public,anon,authenticated;

grant execute on function public.birdshop_send_service_chat_message(text,text) to service_role;


revoke execute on function public.birdshop_get_service_chat(text) from public,anon,authenticated;
grant execute on function public.birdshop_get_service_chat(text) to service_role;
revoke execute on function public.birdshop_open_service_chat(text,text) from public,anon,authenticated;

create table public.birdshop_chat_submissions (
 request_id uuid primary key, conversation_id uuid not null references public.service_conversations(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.birdshop_chat_submissions enable row level security;
revoke all on public.birdshop_chat_submissions from public,anon,authenticated;
grant all on public.birdshop_chat_submissions to service_role;
create function public.birdshop_v2_create_chat_once(p_request_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; c public.service_conversations%rowtype;
begin
 perform private.birdshop_require_server();
 if p_request_id is null or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid request.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,1));
 select sc.* into c from public.birdshop_chat_submissions s join public.service_conversations sc on sc.id=s.conversation_id where s.request_id=p_request_id;
 if found then
   if c.deleted_at is not null then raise exception 'Unavailable.'; end if;
   return jsonb_build_object('conversation_id',c.id,'public_token',c.public_token,'reference',c.reference,'conversation_type',c.conversation_type);
 end if;
 result:=public.birdshop_create_conversation(
 p_input->>'p_conversation_type',p_input->>'p_customer_name',p_input->>'p_customer_email',p_input->>'p_customer_contact',
 p_input->>'p_subject',p_input->>'p_message',p_input->>'p_service_slug',p_input->>'p_service_name',
 p_input->>'p_package_id',p_input->>'p_package_name',p_input->>'p_product_slug',p_input->>'p_product_name',p_input->>'p_product_platform',p_input->>'p_product_region');
 insert into public.birdshop_chat_submissions(request_id,conversation_id) values(p_request_id,(result->>'conversation_id')::uuid);
 return result;
end $$;
revoke all on function public.birdshop_v2_create_chat_once(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.birdshop_v2_create_chat_once(uuid,jsonb) to service_role;
commit;
