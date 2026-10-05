begin;
create table if not exists public.birdshop_customer_devices (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(), expires_at timestamptz not null
);
create table if not exists public.birdshop_customer_device_chats (
 device_hash text not null references public.birdshop_customer_devices(token_hash) on delete cascade,
 conversation_id uuid not null references public.service_conversations(id) on delete cascade,
 remembered_at timestamptz not null default now(), expires_at timestamptz not null,
 primary key(device_hash,conversation_id)
);
alter table public.birdshop_customer_devices enable row level security;
alter table public.birdshop_customer_device_chats enable row level security;
revoke all on public.birdshop_customer_devices,public.birdshop_customer_device_chats from public,anon,authenticated;
grant select,insert,update,delete on public.birdshop_customer_devices,public.birdshop_customer_device_chats to service_role;
create index if not exists birdshop_device_expiry on public.birdshop_customer_devices(expires_at);
create index if not exists birdshop_device_chat_page on public.birdshop_customer_device_chats(device_hash,remembered_at desc,conversation_id desc);

-- Knowing an email/reference cannot enroll a chat. Its private token is required.
create or replace function public.birdshop_remember_device_chat(p_device_hash text,p_chat_token text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if p_device_hash is null or p_device_hash !~ '^[a-f0-9]{64}$' then return false; end if;
 select c.id into v_id from public.service_conversations c where c.public_token=p_chat_token and c.deleted_at is null;
 if v_id is null then return false; end if;
 insert into public.birdshop_customer_devices(token_hash,expires_at) values(p_device_hash,now()+interval '30 days')
 on conflict(token_hash) do update set expires_at=excluded.expires_at;
 insert into public.birdshop_customer_device_chats(device_hash,conversation_id,expires_at) values(p_device_hash,v_id,now()+interval '30 days')
 on conflict(device_hash,conversation_id) do update set remembered_at=now(),expires_at=excluded.expires_at;
 return true;
end $$;
create or replace function public.birdshop_list_device_chats(p_device_hash text,p_offset integer default 0)
returns table(id uuid,reference text,subject text,conversation_type text,conversation_status text,service_name text,product_name text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.id,c.reference::text,c.subject::text,c.conversation_type::text,c.status::text,c.service_name::text,c.product_name::text,c.created_at
 from public.birdshop_customer_devices d join public.birdshop_customer_device_chats g on g.device_hash=d.token_hash
 join public.service_conversations c on c.id=g.conversation_id
 where d.token_hash=p_device_hash and d.expires_at>now() and g.expires_at>now() and c.deleted_at is null
 order by g.remembered_at desc,g.conversation_id desc limit 51 offset greatest(0,p_offset);
$$;
create or replace function public.birdshop_open_device_chat(p_device_hash text,p_conversation_id uuid)
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select c.public_token::text from public.birdshop_customer_devices d
 join public.birdshop_customer_device_chats g on g.device_hash=d.token_hash
 join public.service_conversations c on c.id=g.conversation_id
 where d.token_hash=p_device_hash and c.id=p_conversation_id and d.expires_at>now() and g.expires_at>now() and c.deleted_at is null;
$$;
revoke all on function public.birdshop_remember_device_chat(text,text) from public,anon,authenticated;
revoke all on function public.birdshop_list_device_chats(text,integer) from public,anon,authenticated;
revoke all on function public.birdshop_open_device_chat(text,uuid) from public,anon,authenticated;
grant execute on function public.birdshop_remember_device_chat(text,text) to service_role;
grant execute on function public.birdshop_list_device_chats(text,integer) to service_role;
grant execute on function public.birdshop_open_device_chat(text,uuid) to service_role;
commit;
