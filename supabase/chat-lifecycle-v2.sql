-- =========================================================
-- BIRDSHOP CHAT LIFECYCLE V2
--
-- Adds:
--   Active conversations
--   Closed conversations
--   Deleted conversations
--   Restore
--   Permanent deletion
--
-- Chat deletion remains separate from deleting the order.
-- =========================================================


-- =========================================================
-- CONVERSATION DELETION METADATA
-- =========================================================

alter table public.service_conversations
add column if not exists deleted_at timestamptz;

alter table public.service_conversations
add column if not exists deleted_by uuid;


-- =========================================================
-- ADMIN SOFT DELETE
-- =========================================================

create or replace function
public.birdshop_admin_delete_service_conversation(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  if
    coalesce(auth.role(), '') <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception
      'Not authorized.';
  end if;


  if not exists (
    select 1
    from public.service_conversations
    where id = p_conversation_id
  ) then
    raise exception
      'Conversation not found.';
  end if;


  update public.service_conversations
  set
    status = 'closed',
    deleted_at = now(),
    deleted_by = auth.uid()
  where id = p_conversation_id;

end;
$$;


-- =========================================================
-- ADMIN RESTORE
-- =========================================================

create or replace function
public.birdshop_admin_restore_service_conversation(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  if
    coalesce(auth.role(), '') <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception
      'Not authorized.';
  end if;


  update public.service_conversations
  set
    status = 'closed',
    deleted_at = null,
    deleted_by = null
  where id = p_conversation_id;


  if not found then
    raise exception
      'Conversation not found.';
  end if;

end;
$$;


-- =========================================================
-- ADMIN PERMANENT DELETE
--
-- This removes the chat transcript and payment-request
-- objects attached to the conversation.
--
-- It DOES NOT delete the order itself.
-- =========================================================

create or replace function
public.birdshop_admin_permanently_delete_service_conversation(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  if
    coalesce(auth.role(), '') <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception
      'Not authorized.';
  end if;


  if not exists (
    select 1
    from public.service_conversations
    where id = p_conversation_id
      and deleted_at is not null
  ) then
    raise exception
      'Only deleted conversations can be permanently removed.';
  end if;


  delete from public.service_conversations
  where id = p_conversation_id;

end;
$$;


-- =========================================================
-- PERMISSIONS
-- =========================================================

revoke all
on function
public.birdshop_admin_delete_service_conversation(uuid)
from public;

grant execute
on function
public.birdshop_admin_delete_service_conversation(uuid)
to authenticated,
service_role;


revoke all
on function
public.birdshop_admin_restore_service_conversation(uuid)
from public;

grant execute
on function
public.birdshop_admin_restore_service_conversation(uuid)
to authenticated,
service_role;


revoke all
on function
public.birdshop_admin_permanently_delete_service_conversation(uuid)
from public;

grant execute
on function
public.birdshop_admin_permanently_delete_service_conversation(uuid)
to authenticated,
service_role;


notify pgrst, 'reload schema';