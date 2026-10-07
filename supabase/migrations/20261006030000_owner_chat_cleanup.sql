begin;

-- Chat removal is separate from receipt/refund retention.
-- An inaccessible conversation anchor keeps payment callbacks and order
-- references valid. The transcript is erased, access is revoked, and restore
-- is impossible. No financial deletion guard is relaxed.
alter table public.service_conversations add column if not exists purged_at timestamptz;

create or replace function private.birdshop_keep_purged_chat_closed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.purged_at is not null then
  new.purged_at := old.purged_at;
  new.deleted_at := coalesce(old.deleted_at,old.purged_at);
  new.deleted_by := old.deleted_by;
  new.status := 'closed';
  new.request_message := null;
 elsif new.purged_at is not null and not public.is_birdshop_owner() then
  raise exception 'Active owner required.';
 end if;
 return new;
end $$;
drop trigger if exists birdshop_keep_purged_chat_closed on public.service_conversations;
create trigger birdshop_keep_purged_chat_closed before update on public.service_conversations
 for each row execute function private.birdshop_keep_purged_chat_closed();

-- A later webhook can finish accounting, but cannot recreate a removed chat.
create or replace function private.birdshop_skip_purged_chat_message()
returns trigger language plpgsql security definer set search_path='' as $$
declare removed_at timestamptz;
begin
 select purged_at into removed_at from public.service_conversations
  where id=new.conversation_id for share;
 if removed_at is not null then return null; end if;
 return new;
end $$;
drop trigger if exists birdshop_skip_purged_chat_message on public.service_messages;
create trigger birdshop_skip_purged_chat_message before insert on public.service_messages
 for each row execute function private.birdshop_skip_purged_chat_message();

create or replace function public.birdshop_admin_permanently_delete_service_conversation(p_conversation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.service_conversations%rowtype;
begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
 select * into c from public.service_conversations where id=p_conversation_id for update;
 if not found then raise exception 'Conversation not found.'; end if;
 if c.purged_at is not null then return; end if;
 -- Chats without order/payment dependencies can be removed outright.
 if c.order_id is null and not exists(select 1 from public.service_payment_requests where conversation_id=c.id) then
  delete from public.service_messages where conversation_id=c.id;
  delete from public.birdshop_customer_device_chats where conversation_id=c.id;
  delete from public.service_conversations where id=c.id;
  insert into public.birdshop_audit_log(actor_id,action,entity_id,details)
   values(auth.uid(),'conversation_permanently_deleted',c.id,jsonb_build_object('reference',c.reference));
  return;
 end if;
 update public.service_conversations set purged_at=now(),deleted_at=now(),deleted_by=auth.uid(),status='closed',request_message=null
  where id=c.id;
 delete from public.service_messages where conversation_id=c.id;
 delete from public.birdshop_customer_device_chats where conversation_id=c.id;
 insert into public.birdshop_audit_log(actor_id,action,entity_id,details)
 values(auth.uid(),'conversation_transcript_permanently_deleted',c.id,jsonb_build_object('reference',c.reference,'billing_records_retained',true));
end $$;

create or replace function public.birdshop_admin_delete_service_conversation(p_conversation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
 update public.service_conversations set status='closed',deleted_at=now(),deleted_by=auth.uid()
  where id=p_conversation_id and purged_at is null;
 if not found then raise exception 'Conversation not found.'; end if;
end $$;

create or replace function public.birdshop_admin_restore_service_conversation(p_conversation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
 update public.service_conversations set status='closed',deleted_at=null,deleted_by=null
  where id=p_conversation_id and purged_at is null;
 if not found then raise exception 'Conversation unavailable or permanently removed.'; end if;
end $$;

-- Owner RPC does not depend on browser inventory SELECT privileges. No code
-- ciphertext is returned. Lock product before inventory, as checkout does.
create or replace function public.birdshop_owner_remove_inventory_code(p_inventory_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare product uuid; current_code public.product_inventory%rowtype;
begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
 select product_id into product from public.product_inventory where id=p_inventory_id;
 if not found then raise exception 'Inventory code already removed or not found.'; end if;
 perform 1 from public.products where id=product for update;
 select * into current_code from public.product_inventory where id=p_inventory_id for update;
 if not found then raise exception 'Inventory code already removed or not found.'; end if;
 if current_code.product_id is distinct from product then raise exception 'Inventory changed. Refresh and retry.'; end if;
 if current_code.status not in ('available','disabled') or exists(select 1 from public.order_fulfillments where product_inventory_id=p_inventory_id) or exists(select 1 from public.birdshop_checkout_inventory where inventory_id=p_inventory_id) then
  raise exception 'Reserved or sold codes cannot be removed. Release a reservation or use test-sale cleanup where applicable.';
 end if;
 delete from public.product_inventory where id=p_inventory_id;
 insert into public.birdshop_audit_log(actor_id,action,entity_id,details)
 values(auth.uid(),'owner_inventory_code_removed',p_inventory_id,jsonb_build_object('product_id',product));
end $$;

revoke all on function private.birdshop_keep_purged_chat_closed(), private.birdshop_skip_purged_chat_message() from public,anon,authenticated;
revoke all on function public.birdshop_admin_permanently_delete_service_conversation(uuid),public.birdshop_admin_delete_service_conversation(uuid),public.birdshop_admin_restore_service_conversation(uuid),public.birdshop_owner_remove_inventory_code(uuid) from public,anon,authenticated,service_role;
grant execute on function public.birdshop_admin_permanently_delete_service_conversation(uuid),public.birdshop_admin_delete_service_conversation(uuid),public.birdshop_admin_restore_service_conversation(uuid),public.birdshop_owner_remove_inventory_code(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
