begin;
create table if not exists public.birdshop_customer_login_links (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 email text not null check (email = lower(trim(email))),
 created_at timestamptz not null default now(), expires_at timestamptz not null, used_at timestamptz
);
create table if not exists public.birdshop_customer_sessions (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 email text not null check (email = lower(trim(email))),
 created_at timestamptz not null default now(), expires_at timestamptz not null
);
alter table public.birdshop_customer_login_links enable row level security;
alter table public.birdshop_customer_sessions enable row level security;
revoke all on public.birdshop_customer_login_links, public.birdshop_customer_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.birdshop_customer_login_links, public.birdshop_customer_sessions to service_role;
create index if not exists birdshop_customer_login_expiry on public.birdshop_customer_login_links(expires_at);
create index if not exists birdshop_customer_session_expiry on public.birdshop_customer_sessions(expires_at);
create index if not exists birdshop_customer_inbox_email on public.service_conversations(lower(trim(customer_email)),created_at desc,id desc) where deleted_at is null;

-- Atomic consumption: concurrent link reuse cannot create a second session.
create or replace function public.birdshop_customer_verify_link(p_link_hash text,p_session_hash text,p_remember boolean)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text;
begin
 if p_session_hash is null or p_session_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid session'; end if;
 update public.birdshop_customer_login_links set used_at=now()
 where token_hash=p_link_hash and used_at is null and expires_at>now() returning email into v_email;
 if v_email is null then return null; end if;
 insert into public.birdshop_customer_sessions(token_hash,email,expires_at)
 values(p_session_hash,v_email,now()+case when p_remember then interval '30 days' else interval '12 hours' end);
 return v_email;
end $$;
create or replace function public.birdshop_customer_list_chats(p_email text,p_offset integer default 0)
returns table(id uuid,reference text,subject text,conversation_type text,conversation_status text,service_name text,product_name text,created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
 select c.id,c.reference::text,c.subject::text,c.conversation_type::text,c.status::text,c.service_name::text,c.product_name::text,c.created_at
 from public.service_conversations c where lower(trim(c.customer_email))=lower(trim(p_email)) and c.deleted_at is null
 order by c.created_at desc,c.id desc limit 51 offset greatest(0,p_offset);
$$;
create or replace function public.birdshop_customer_open_chat(p_email text,p_conversation_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
 select c.public_token::text from public.service_conversations c
 where c.id=p_conversation_id and lower(trim(c.customer_email))=lower(trim(p_email)) and c.deleted_at is null;
$$;
revoke all on function public.birdshop_customer_verify_link(text,text,boolean) from public,anon,authenticated;
revoke all on function public.birdshop_customer_list_chats(text,integer) from public,anon,authenticated;
revoke all on function public.birdshop_customer_open_chat(text,uuid) from public,anon,authenticated;
grant execute on function public.birdshop_customer_verify_link(text,text,boolean) to service_role;
grant execute on function public.birdshop_customer_list_chats(text,integer) to service_role;
grant execute on function public.birdshop_customer_open_chat(text,uuid) to service_role;
commit;
