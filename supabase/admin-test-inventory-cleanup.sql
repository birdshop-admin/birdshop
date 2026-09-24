/* =========================================================
   BIRDSHOP TEST INVENTORY CLEANUP

   Purpose:
   - Real sold/reserved inventory remains protected history.
   - Admin-test fulfillments can be reset or removed safely.
   - Resetting a test sale restores every key from that test
     order to AVAILABLE before removing the test order.
========================================================= */

/* =========================================================
   RESET TEST SALE
========================================================= */

create or replace function
public.birdshop_reset_test_inventory_sale(
  p_inventory_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_source text;
begin
  if
    coalesce(
      auth.role(),
      ''
    ) <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception 'Not authorized.';
  end if;

  select
    o.id,
    o.source
  into
    v_order_id,
    v_order_source
  from public.order_fulfillments ofu
  join public.orders o
    on o.id = ofu.order_id
  where ofu.product_inventory_id = p_inventory_id
  limit 1;

  if v_order_id is null then
    raise exception 'No order is linked to this inventory record.';
  end if;

  if v_order_source <> 'admin_test' then
    raise exception 'Only admin test fulfillments can be reset from Inventory.';
  end if;

  perform 1
  from public.orders
  where id = v_order_id
  for update;

  update public.product_inventory pi
  set
    status = 'available',
    reserved_reference = null,
    reserved_at = null,
    sold_at = null,
    updated_at = now()
  where pi.id in (
    select
      linked.product_inventory_id
    from public.order_fulfillments linked
    where linked.order_id = v_order_id
  )
  and pi.status in (
    'reserved',
    'sold'
  );

  delete from public.orders
  where id = v_order_id;
end;
$$;

/* =========================================================
   DELETE ONE TEST KEY + TEST ORDER

   The selected key is permanently deleted.
   Any other keys belonging to the same test order are safely
   restored to AVAILABLE before the test order is removed.
========================================================= */

create or replace function
public.birdshop_delete_test_fulfilled_inventory(
  p_inventory_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_source text;
begin
  if
    coalesce(
      auth.role(),
      ''
    ) <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception 'Not authorized.';
  end if;

  select
    o.id,
    o.source
  into
    v_order_id,
    v_order_source
  from public.order_fulfillments ofu
  join public.orders o
    on o.id = ofu.order_id
  where ofu.product_inventory_id = p_inventory_id
  limit 1;

  if v_order_id is null then
    raise exception 'No order is linked to this inventory record.';
  end if;

  if v_order_source <> 'admin_test' then
    raise exception 'Real fulfillment history cannot be deleted from Inventory.';
  end if;

  perform 1
  from public.orders
  where id = v_order_id
  for update;

  update public.product_inventory pi
  set
    status = 'available',
    reserved_reference = null,
    reserved_at = null,
    sold_at = null,
    updated_at = now()
  where pi.id in (
    select
      linked.product_inventory_id
    from public.order_fulfillments linked
    where linked.order_id = v_order_id
  )
  and pi.id <> p_inventory_id
  and pi.status in (
    'reserved',
    'sold'
  );

  delete from public.orders
  where id = v_order_id;

  delete from public.product_inventory
  where id = p_inventory_id;
end;
$$;

/* =========================================================
   PERMISSIONS
========================================================= */

revoke all
on function public.birdshop_reset_test_inventory_sale(uuid)
from public, anon;

grant execute
on function public.birdshop_reset_test_inventory_sale(uuid)
to authenticated, service_role;

revoke all
on function public.birdshop_delete_test_fulfilled_inventory(uuid)
from public, anon;

grant execute
on function public.birdshop_delete_test_fulfilled_inventory(uuid)
to authenticated, service_role;
