-- BirdShop: paid package chats stay in the admin "New" tab until staff reply.
-- Package purchases open their chat with workflow_status 'paid'. The legacy send
-- helper only moved 'new' to 'discussing', so a paid chat never showed that staff
-- had picked it up. Identical to 20261005030000 except for the marked update.
begin;

create or replace function public.birdshop_v3_staff_send_message(p_conversation_id uuid,p_body text,p_request_id uuid) returns uuid
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
 -- New: the first staff reply on a paid package chat starts the work.
 update public.service_conversations set workflow_status='in_progress'
  where id=p_conversation_id and workflow_status='paid';
 return new_id;
end $$;
revoke all on function public.birdshop_v3_staff_send_message(uuid,text,uuid) from public,anon;
grant execute on function public.birdshop_v3_staff_send_message(uuid,text,uuid) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
