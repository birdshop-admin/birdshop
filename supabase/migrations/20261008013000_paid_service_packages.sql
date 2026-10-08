begin;

-- Package checkout holds a price snapshot, not a usable conversation.
alter table public.birdshop_checkout_attempts drop constraint birdshop_checkout_kind;
alter table public.birdshop_checkout_attempts add constraint birdshop_checkout_kind
 check(kind in ('service','product','package'));
alter table public.birdshop_checkout_attempts drop constraint birdshop_checkout_relationship;
alter table public.birdshop_checkout_attempts add constraint birdshop_checkout_relationship
 check((kind='service' and payment_request_id is not null)
    or (kind='product' and payment_request_id is null) or kind='package');

create table public.birdshop_package_checkouts (
 attempt_id uuid primary key references public.birdshop_checkout_attempts(id) on delete restrict,
 fingerprint jsonb not null,
 service_slug text not null,
 service_name text not null,
 tier_id text not null,
 tier_name text not null,
 description text not null,
 conversation_id uuid unique references public.service_conversations(id) on delete restrict,
 created_at timestamptz not null default now()
);
alter table public.birdshop_package_checkouts enable row level security;
revoke all on public.birdshop_package_checkouts from public,anon,authenticated;
grant select,insert,update on public.birdshop_package_checkouts to service_role;

create function public.birdshop_begin_package_checkout(
 p_request_id uuid,p_slug text,p_tier text,p_name text,p_email text,
 p_expected_cents bigint,p_access_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.birdshop_services%rowtype; pack jsonb;
 a public.birdshop_checkout_attempts%rowtype; saved public.birdshop_package_checkouts%rowtype;
 f jsonb; description text;
begin
 perform private.birdshop_require_server();
 if p_request_id is null or p_tier is null or p_tier not in ('starter','standard','premium')
 or p_name is null or length(trim(p_name)) not between 2 and 100
 or p_email is null or length(p_email)>320 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or p_access_hash is null or p_access_hash !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid purchase.'; end if;
 f:=jsonb_build_object('slug',p_slug,'tier',p_tier,'name',trim(p_name),
 'email',lower(trim(p_email)),'cents',p_expected_cents);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,9));
 -- Do not turn a retry of a historical purchase into a second payment.
 if exists(select 1 from public.birdshop_service_purchases where request_id=p_request_id)
 then raise exception 'Historical purchase: check its original payment before starting again.'; end if;
 select * into a from public.birdshop_checkout_attempts where id=p_request_id for update;
 if found then
   select * into saved from public.birdshop_package_checkouts where attempt_id=a.id;
   if not found or a.kind<>'package' or a.access_hash is distinct from p_access_hash
      or saved.fingerprint is distinct from f then raise exception 'Purchase does not match.'; end if;
   return to_jsonb(a);
 end if;
 select * into s from public.birdshop_services
 where slug=p_slug and is_visible and deleted_at is null for share;
 if not found or not coalesce((s.data->>'available')::boolean,false)
 then raise exception 'Service unavailable.'; end if;
 select x into pack from jsonb_array_elements(s.packages) x
 where x->>'id'=p_tier and x->>'enabled'='true';
 if pack is null or (pack->>'cents')::bigint not between 50 and 99999999
 or length(trim(pack->>'scope'))<5 or p_expected_cents is null
 or p_expected_cents is distinct from (pack->>'cents')::bigint
 then raise exception 'Package or price changed. Refresh before purchasing.'; end if;
 description:=left((pack->>'scope')||E'\nIncluded: '||coalesce(
 (select string_agg(value,E'\n') from jsonb_array_elements_text(pack->'includes')),''),4000);
 insert into public.birdshop_checkout_attempts(id,kind,expected_cents,customer_name,customer_email,access_hash,cart)
 values(p_request_id,'package',p_expected_cents,trim(p_name),lower(trim(p_email)),p_access_hash,
 jsonb_build_array(jsonb_build_object('id',p_request_id,'slug',p_slug,
 'name',left((s.data->>'name')||' — '||(pack->>'name'),180),
 'quantity',1,'unit_cents',p_expected_cents,'line_cents',p_expected_cents))) returning * into a;
 insert into public.birdshop_package_checkouts(attempt_id,fingerprint,service_slug,service_name,tier_id,tier_name,description)
 values(a.id,f,p_slug,s.data->>'name',p_tier,pack->>'name',description);
 return to_jsonb(a);
end $$;

create function public.birdshop_finalize_package_payment(
 p_attempt_id uuid,p_session_id text,p_intent_id text,p_customer_id text,
 p_amount bigint,p_currency text,p_email text
) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.birdshop_checkout_attempts%rowtype; x public.birdshop_package_checkouts%rowtype;
 chat_id uuid; payment_id uuid; order_id uuid;
begin
 perform private.birdshop_require_server();
 select * into a from public.birdshop_checkout_attempts where id=p_attempt_id for update;
 if not found or a.kind<>'package' or a.stripe_session_id is distinct from p_session_id
 or a.expected_cents is distinct from p_amount or a.currency is distinct from lower(p_currency)
 or a.stripe_payment_status is distinct from 'paid' or nullif(p_intent_id,'') is null
 or a.payment_intent_id is distinct from p_intent_id
 then raise exception 'Verified package payment required.'; end if;
 if a.order_id is not null then return a.order_id; end if;
 select * into x from public.birdshop_package_checkouts where attempt_id=a.id for update;
 if not found or x.conversation_id is not null then raise exception 'Package needs reconciliation.'; end if;
 -- A verified purchase must not be blocked by the contact-form request limit.
 insert into public.service_conversations(conversation_type,workflow_status,customer_name,customer_email,
 subject,request_message,service_slug,service_name,package_id,package_name,status,source)
 values('service','new',a.customer_name,a.customer_email,left(x.service_name||' — '||x.tier_name,180),
 x.description,x.service_slug,x.service_name,x.tier_id,x.tier_name,'open','website') returning id into chat_id;
 insert into public.service_messages(conversation_id,sender_type,sender_label,body)
 values(chat_id,'customer',a.customer_name,x.description);
 -- These jobs are not visible outside this transaction. Send the paid receipt instead.
 delete from public.birdshop_email_jobs where entity_id=chat_id
 and kind in ('conversation_customer','conversation_admin') and status='queued';
 insert into public.service_payment_requests(conversation_id,amount,currency,title,description,status,previous_workflow_status)
 values(chat_id,a.expected_cents::numeric/100,a.currency,left(x.service_name||' — '||x.tier_name,180),
 left(x.description,2000),'pending',(select workflow_status from public.service_conversations where id=chat_id))
 returning id into payment_id;
 update public.birdshop_checkout_attempts set payment_request_id=payment_id where id=a.id;
 order_id:=public.birdshop_finalize_service_payment(payment_id,p_session_id,p_intent_id,
 p_customer_id,p_amount,p_currency,p_email);
 update public.birdshop_package_checkouts set conversation_id=chat_id where attempt_id=a.id;
 return order_id;
end $$;

revoke all on function public.birdshop_begin_package_checkout(uuid,text,text,text,text,bigint,text) from public,anon,authenticated;
revoke all on function public.birdshop_finalize_package_payment(uuid,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.birdshop_begin_package_checkout(uuid,text,text,text,text,bigint,text) to service_role;
grant execute on function public.birdshop_finalize_package_payment(uuid,text,text,text,bigint,text,text) to service_role;

-- Stop the previous API from opening new unpaid conversations during deployment.
create or replace function public.birdshop_buy_service_package(
 p_request_id uuid,p_slug text,p_tier text,p_name text,p_email text,p_expected_cents bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.birdshop_require_server();
 raise exception 'Service checkout is updating. Refresh and retry shortly.';
end $$;

-- Existing unpaid package chats stay hidden; verified payment can reopen them.
create function private.birdshop_lock_unpaid_package_chat() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.birdshop_service_purchases s
 join public.service_payment_requests p on p.id=s.payment_request_id
 where s.conversation_id=new.id and p.paid_at is null and p.order_id is null) then
   new.status:='closed';
   new.deleted_at:=coalesce(new.deleted_at,old.deleted_at,now());
 end if;
 return new;
end $$;
revoke all on function private.birdshop_lock_unpaid_package_chat() from public,anon,authenticated;
create trigger birdshop_lock_unpaid_package_chat before update on public.service_conversations
 for each row execute function private.birdshop_lock_unpaid_package_chat();
update public.service_conversations c set status='closed',deleted_at=coalesce(c.deleted_at,now())
where exists(select 1 from public.birdshop_service_purchases s
join public.service_payment_requests p on p.id=s.payment_request_id
where s.conversation_id=c.id and p.paid_at is null and p.order_id is null);
update public.birdshop_email_jobs j set status='cancelled',lease_id=null,lease_until=null,
 last_error='Package chat email replaced by verified payment receipt.'
where j.kind in ('conversation_customer','conversation_admin','recovery')
 and j.status in ('queued','failed','attention')
 and exists(select 1 from public.birdshop_service_purchases s where s.conversation_id=j.entity_id);
notify pgrst,'reload schema';
commit;
