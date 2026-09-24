-- =========================================================
-- BIRDSHOP
-- COMPLETED / DELETED ADMIN WORKFLOW
--
-- Adds:
--   Orders -> Deleted
--   Support -> Deleted
--   soft-delete / restore
--   permanent-delete protection for paid real orders
-- =========================================================


-- =========================================================
-- SOFT DELETE COLUMNS
-- =========================================================

alter table public.orders
add column if not exists deleted_at timestamptz;

alter table public.support_requests
add column if not exists deleted_at timestamptz;


create index if not exists orders_deleted_at_idx
on public.orders (deleted_at);

create index if not exists support_requests_deleted_at_idx
on public.support_requests (deleted_at);


-- =========================================================
-- PERMANENT ORDER DELETE
--
-- Real paid orders are intentionally protected.
--
-- Admin test orders and unpaid orders may be permanently
-- removed.
-- =========================================================

create or replace function
public.birdshop_permanently_delete_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin

  if
    coalesce(auth.role(), '') <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception 'Not authorized.';
  end if;


  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;


  if not found then
    raise exception 'Order not found.';
  end if;


  -- Real money records should not be destroyed.
  if
    v_order.payment_status = 'paid'
    and v_order.source <> 'admin_test'
  then
    raise exception
      'Real paid orders cannot be permanently deleted. Keep the record in Deleted or Archived.';
  end if;


  -- If an unpaid/test product order ever reserved inventory,
  -- release it before deleting the order.
  update public.product_inventory
  set
    status = 'available',
    reserved_reference = null,
    sold_at = null,
    updated_at = now()
  where id in (
    select product_inventory_id
    from public.order_fulfillments
    where order_id = p_order_id
  );


  delete from public.order_fulfillments
  where order_id = p_order_id;


  delete from public.order_items
  where order_id = p_order_id;


  delete from public.orders
  where id = p_order_id;

end;
$$;


revoke all
on function public.birdshop_permanently_delete_order(uuid)
from public;

grant execute
on function public.birdshop_permanently_delete_order(uuid)
to authenticated,
service_role;


-- =========================================================
-- PERMANENT SUPPORT DELETE
-- =========================================================

create or replace function
public.birdshop_permanently_delete_support_request(
  p_request_id uuid
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
    raise exception 'Not authorized.';
  end if;


  if not exists (
    select 1
    from public.support_requests
    where id = p_request_id
  ) then
    raise exception 'Support request not found.';
  end if;


  delete from public.support_requests
  where id = p_request_id;

end;
$$;


revoke all
on function public.birdshop_permanently_delete_support_request(uuid)
from public;

grant execute
on function public.birdshop_permanently_delete_support_request(uuid)
to authenticated,
service_role;


notify pgrst, 'reload schema';