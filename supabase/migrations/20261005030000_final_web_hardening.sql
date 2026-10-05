-- Final corrective pass. Apply after all six earlier migrations. No historical data is deleted.
begin;
-- Prevent search-path object substitution in legacy routines.
revoke create on schema public from public, anon, authenticated;

-- Explicit table boundaries also constrain any permissive legacy policies.
alter table public.orders enable row level security;
revoke all on public.orders from public, anon;
create policy birdshop_final_owner_boundary on public.orders as restrictive to authenticated using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
alter table public.order_items enable row level security;
revoke all on public.order_items from public, anon;
create policy birdshop_final_owner_boundary on public.order_items as restrictive to authenticated using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
alter table public.order_fulfillments enable row level security;
revoke all on public.order_fulfillments from public, anon;
create policy birdshop_final_owner_boundary on public.order_fulfillments as restrictive to authenticated using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
alter table public.product_inventory enable row level security;
revoke all on public.product_inventory from public, anon;
create policy birdshop_final_owner_boundary on public.product_inventory as restrictive to authenticated using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
alter table public.reviews enable row level security;
revoke all on public.reviews from public, anon;
create policy birdshop_final_owner_boundary on public.reviews as restrictive to authenticated using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon;
create policy birdshop_final_owner_boundary on public.support_requests as restrictive to authenticated using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
alter table public.page_views enable row level security;
revoke all on public.page_views from public, anon;
create policy birdshop_final_owner_boundary on public.page_views as restrictive to authenticated using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
alter table public.site_sessions enable row level security;
revoke all on public.site_sessions from public, anon;
create policy birdshop_final_owner_boundary on public.site_sessions as restrictive to authenticated using (public.is_birdshop_owner()) with check (public.is_birdshop_owner());
-- Inventory mutations/reveals are audited server actions; browser receives masked columns only.
revoke all on public.product_inventory from authenticated;
do $$ declare t text; cols text; begin
 foreach t in array array['product_inventory','service_messages','service_payment_requests','admin_users'] loop
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=t;
  execute format('revoke insert(%s),update(%s),references(%s) on public.%I from public,anon,authenticated',cols,cols,cols,t);
 end loop;
end $$;
grant select(id,product_id,code_hint,status,note,reserved_reference,reserved_at,sold_at,created_by,created_at,updated_at) on public.product_inventory to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.service_messages,public.service_payment_requests,public.admin_users from public,anon,authenticated;
revoke all on public.service_conversations,public.service_messages,public.service_payment_requests,public.admin_users from public,anon;
alter table public.admin_users enable row level security;
create policy birdshop_final_membership_boundary on public.admin_users as restrictive to authenticated using (user_id=auth.uid()) with check(false);
alter table public.service_conversations enable row level security;
create policy birdshop_final_staff_boundary on public.service_conversations as restrictive to authenticated using (public.is_birdshop_owner() or (public.is_birdshop_service_agent() and conversation_type='service' and assigned_staff_user_id=auth.uid() and deleted_at is null)) with check(public.is_birdshop_owner());
alter table public.service_messages enable row level security;
create policy birdshop_final_staff_boundary on public.service_messages as restrictive to authenticated using (public.is_birdshop_owner() or (public.is_birdshop_service_agent() and exists(select 1 from public.service_conversations c where c.id=service_messages.conversation_id and c.conversation_type='service' and c.assigned_staff_user_id=auth.uid() and c.deleted_at is null))) with check(public.is_birdshop_owner());
alter table public.service_payment_requests enable row level security;
create policy birdshop_final_staff_boundary on public.service_payment_requests as restrictive to authenticated using (public.is_birdshop_owner() or (public.is_birdshop_service_agent() and exists(select 1 from public.service_conversations c where c.id=service_payment_requests.conversation_id and c.conversation_type='service' and c.assigned_staff_user_id=auth.uid() and c.deleted_at is null))) with check(public.is_birdshop_owner());
-- Message UUID is a client-generated retry identity, scoped to the verified conversation.
alter table public.service_messages add column client_request_id uuid;
create unique index birdshop_message_retry_once on public.service_messages(conversation_id,client_request_id) where client_request_id is not null;
create function public.birdshop_v3_send_message(p_token text,p_body text,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare c_id uuid; m public.service_messages%rowtype; new_id uuid;
begin
 perform private.birdshop_require_server();
 if p_request_id is null then raise exception 'Message identity required.';end if;
 select id into c_id from public.service_conversations where public_token=p_token and deleted_at is null for update;
 if c_id is null then raise exception 'Conversation unavailable.';end if;
 select * into m from public.service_messages where conversation_id=c_id and client_request_id=p_request_id;
 if found then
  if m.body is distinct from trim(p_body) then raise exception 'Message identity conflict.';end if;
  return m.id;
 end if;
 new_id:=public.birdshop_send_service_chat_message(p_token,p_body);
 update public.service_messages set client_request_id=p_request_id where id=new_id;
 return new_id;
end $$;
CREATE OR REPLACE FUNCTION public.birdshop_v3_read_chat(p_token text, p_before uuid default null, p_mark_read boolean default true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token text;

  v_conversation_id uuid;

  v_result jsonb;
begin
  perform private.birdshop_require_server();

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

  if p_mark_read and p_before is null then
  update public.service_conversations

  set
    customer_last_read_at =
      now()

  where
    id =
      v_conversation_id;
  end if;


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

            from (select r.* from public.service_payment_requests r where r.conversation_id=c.id order by r.created_at desc limit 100) pr

              where pr.status =
                'paid'
          )
          then
            'paid'


          when exists (
            select 1

            from (select r.* from public.service_payment_requests r where r.conversation_id=c.id order by r.created_at desc limit 100) pr

              where pr.status =
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
                  m.created_at,m.id

              )

            from (select sm.* from public.service_messages sm where sm.conversation_id=c.id
              and (p_before is null or (sm.created_at,sm.id)<(select b.created_at,b.id from public.service_messages b where b.id=p_before and b.conversation_id=c.id))
              order by sm.created_at desc,sm.id desc limit 100) m

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

            from (select r.* from public.service_payment_requests r where r.conversation_id=c.id order by r.created_at desc limit 100) pr

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


  return v_result || jsonb_build_object('has_older', exists (
    select 1 from public.service_messages older where older.conversation_id=v_conversation_id
    and (older.created_at,older.id)<(select m.created_at,m.id from public.service_messages m where m.id=(v_result->'messages'->0->>'id')::uuid)
  ));

end;
$function$
;
create or replace function public.birdshop_get_service_chat(p_token text) returns jsonb language sql security definer set search_path='' as $$
 select public.birdshop_v3_read_chat(p_token,null,true);
$$;
-- Index supports bounded conversation history reads and page ordering.
create index if not exists birdshop_message_history_page on public.service_messages(conversation_id,created_at desc,id desc);
create index if not exists birdshop_order_history_page on public.orders(created_at desc,id);

create function public.birdshop_v3_staff_send_message(p_conversation_id uuid,p_body text,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.service_messages%rowtype; new_id uuid;
begin
 if not (public.is_birdshop_owner() or exists(select 1 from public.service_conversations c join public.admin_users a on a.user_id=auth.uid() where c.id=p_conversation_id and c.conversation_type='service' and c.deleted_at is null and c.assigned_staff_user_id=a.user_id and a.role='service_agent' and a.is_active)) then raise exception 'Not authorized.';end if;
 if p_request_id is null then raise exception 'Message identity required.';end if;
 perform 1 from public.service_conversations where id=p_conversation_id for update;
 select * into m from public.service_messages where conversation_id=p_conversation_id and client_request_id=p_request_id;
 if found then
  if m.sender_type<>'admin' or m.body is distinct from trim(p_body) then raise exception 'Message identity conflict.';end if;
  return m.id;
 end if;
 new_id:=public.birdshop_admin_send_service_chat_message(p_conversation_id,p_body);
 update public.service_messages set client_request_id=p_request_id where id=new_id;
 return new_id;
end $$;
alter table public.orders add constraint birdshop_final_refund_bounds check(total>=0 and total<>'NaN'::numeric and refunded_amount>=0 and refunded_amount<=total and refunded_amount<>'NaN'::numeric);
alter table public.service_payment_requests add constraint birdshop_final_request_refund_bounds check(refunded_amount>=0 and refunded_amount<=amount and refunded_amount<>'NaN'::numeric and amount<>'NaN'::numeric);
-- Atomic catalog identity prevents double-submit creating duplicate purchasable slugs.
create unique index if not exists birdshop_product_slug_once on public.products(lower(slug)) where slug<>'';

-- Review every BirdShop routine, including old versions. Default deny; enumerate browser RPCs.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature,p.proname,p.prorettype,n.nspname,p.proconfig
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and (p.proname like 'birdshop_%' or p.proname like 'is_birdshop_%' or p.proname in ('get_approved_reviews','submit_review','submit_service_request','submit_support_request')))
 or (n.nspname='private' and p.prosecdef) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  -- pg_temp must be last, even for legacy functions referring to unqualified relations.
  if f.nspname='public' and (f.proconfig is null or array_to_string(f.proconfig,',') not like '%search_path=""%') then
   execute format('alter function %s set search_path=pg_catalog,public,pg_temp',f.signature);
  end if;
  if f.nspname='public' and f.proname in (
   'is_birdshop_admin','is_birdshop_owner','is_birdshop_service_agent','birdshop_get_my_staff_profile',
   'birdshop_v3_staff_send_message','birdshop_staff_can_manage_service_conversation','birdshop_staff_list_service_queue','birdshop_staff_accept_service_conversation',
   'birdshop_staff_leave_service_conversation','birdshop_staff_mark_service_chat_read',
   'birdshop_staff_create_payment_request','birdshop_admin_create_payment_request','birdshop_admin_delete_service_conversation',
   'birdshop_admin_restore_service_conversation','birdshop_admin_permanently_delete_service_conversation',
   'birdshop_admin_create_test_service_order','birdshop_admin_create_test_order','birdshop_set_service_order_status',
   'birdshop_permanently_delete_order','birdshop_delete_test_order','birdshop_permanently_delete_support_request',
   'birdshop_reset_test_inventory_sale','birdshop_delete_test_fulfilled_inventory','birdshop_recalculate_order_total',
   'birdshop_v2_admin_health','birdshop_v2_sales_stats','birdshop_v2_analytics_series','birdshop_admin_site_analytics') then
    execute format('grant execute on function %s to authenticated',f.signature);
  end if;
  if f.nspname='public' and f.proname in ('get_approved_reviews','birdshop_public_store_stats') then
    execute format('grant execute on function %s to anon,authenticated',f.signature);
  end if;
  if f.nspname='public' and (f.proname like 'birdshop_v2_%' or f.proname like 'birdshop_v3_%' or f.proname in (
    'birdshop_rate_limit','birdshop_track_activity','submit_review','birdshop_create_conversation','birdshop_get_service_chat',
    'birdshop_send_service_chat_message','birdshop_finalize_service_payment','birdshop_sync_service_refund','birdshop_record_service_refund_failure')) then
    execute format('grant execute on function %s to service_role',f.signature);
  end if;
 end loop;
end $$;
grant execute on function private.is_admin() to authenticated;
-- Provider boundaries and jobs are never browser-readable, including through column grants.
do $$ declare t text; cols text; begin
 foreach t in array array['birdshop_checkout_attempts','birdshop_checkout_inventory','birdshop_stripe_events','birdshop_email_jobs','birdshop_audit_log','birdshop_rate_limits','birdshop_chat_submissions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=t;
  execute format('revoke select(%s),insert(%s),update(%s),references(%s) on public.%I from public,anon,authenticated',cols,cols,cols,cols,t);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
