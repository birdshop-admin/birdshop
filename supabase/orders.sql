create extension if not exists pgcrypto;

-- =========================================================
-- ADMIN CHECK
-- =========================================================

create or replace function public.is_birdshop_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all
on function public.is_birdshop_admin()
from public;

grant execute
on function public.is_birdshop_admin()
to authenticated, service_role;

-- =========================================================
-- ORDER REFERENCE SEQUENCE
-- =========================================================

create sequence if not exists
public.birdshop_order_reference_seq
start with 100001;

-- =========================================================
-- ORDERS
-- =========================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  customer_name text not null,
  customer_email text not null,
  customer_contact text,
  order_status text not null default 'pending'
    check (
      order_status in (
        'pending',
        'active',
        'completed',
        'cancelled',
        'refunded'
      )
    ),
  payment_status text not null default 'pending'
    check (
      payment_status in (
        'pending',
        'paid',
        'failed',
        'refunded',
        'cancelled'
      )
    ),
  fulfillment_status text not null default 'unfulfilled'
    check (
      fulfillment_status in (
        'unfulfilled',
        'reserved',
        'fulfilled',
        'cancelled'
      )
    ),
  currency text not null default 'USD',
  subtotal numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  tax_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  payment_provider text,
  payment_reference text,
  source text not null default 'storefront',
  notes text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- ORDER ITEMS
-- =========================================================

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders(id)
    on delete cascade,
  product_id uuid
    references public.products(id)
    on delete set null,
  product_slug text not null,
  product_name text not null,
  product_platform text,
  product_region text,
  unit_price numeric(12, 2) not null
    check (unit_price >= 0),
  quantity integer not null
    check (quantity > 0),
  line_total numeric(12, 2) not null
    check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- ORDER FULFILLMENTS
-- =========================================================

create table if not exists public.order_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders(id)
    on delete cascade,
  order_item_id uuid not null
    references public.order_items(id)
    on delete cascade,
  product_inventory_id uuid not null
    references public.product_inventory(id)
    on delete restrict,
  assigned_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_inventory_id)
);

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists orders_created_at_idx
on public.orders(created_at desc);

create index if not exists orders_payment_status_idx
on public.orders(payment_status);

create index if not exists orders_fulfillment_status_idx
on public.orders(fulfillment_status);

create index if not exists orders_order_status_idx
on public.orders(order_status);

create index if not exists order_items_order_id_idx
on public.order_items(order_id);

create index if not exists order_items_product_id_idx
on public.order_items(product_id);

create index if not exists order_fulfillments_order_id_idx
on public.order_fulfillments(order_id);

create index if not exists order_fulfillments_item_id_idx
on public.order_fulfillments(order_item_id);

-- =========================================================
-- UPDATED AT
-- =========================================================

create or replace function public.birdshop_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at
on public.orders;

create trigger orders_touch_updated_at
before update on public.orders
for each row
execute function public.birdshop_touch_updated_at();

drop trigger if exists order_items_touch_updated_at
on public.order_items;

create trigger order_items_touch_updated_at
before update on public.order_items
for each row
execute function public.birdshop_touch_updated_at();

drop trigger if exists order_fulfillments_touch_updated_at
on public.order_fulfillments;

create trigger order_fulfillments_touch_updated_at
before update on public.order_fulfillments
for each row
execute function public.birdshop_touch_updated_at();

-- =========================================================
-- ORDER REFERENCE
-- =========================================================

create or replace function public.birdshop_assign_order_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or trim(new.reference) = '' then
    new.reference :=
      'BS-' ||
      nextval(
        'public.birdshop_order_reference_seq'
      )::text;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_assign_reference
on public.orders;

create trigger orders_assign_reference
before insert on public.orders
for each row
execute function public.birdshop_assign_order_reference();

-- =========================================================
-- RECALCULATE ORDER TOTAL
-- =========================================================

create or replace function public.birdshop_recalculate_order_total(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12, 2);
begin
  select
    coalesce(
      sum(line_total),
      0
    )
  into v_subtotal
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set
    subtotal = v_subtotal,
    total = greatest(
      v_subtotal
      - discount_total
      + tax_total,
      0
    )
  where id = p_order_id;
end;
$$;

create or replace function public.birdshop_order_item_total_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.birdshop_recalculate_order_total(
      old.order_id
    );

    return old;
  end if;

  perform public.birdshop_recalculate_order_total(
    new.order_id
  );

  if
    tg_op = 'UPDATE'
    and old.order_id <> new.order_id
  then
    perform public.birdshop_recalculate_order_total(
      old.order_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_recalculate_order
on public.order_items;

create trigger order_items_recalculate_order
after insert or update or delete
on public.order_items
for each row
execute function public.birdshop_order_item_total_trigger();

-- =========================================================
-- RLS
-- =========================================================

alter table public.orders
enable row level security;

alter table public.order_items
enable row level security;

alter table public.order_fulfillments
enable row level security;

drop policy if exists
"BirdShop admins manage orders"
on public.orders;

create policy
"BirdShop admins manage orders"
on public.orders
for all
to authenticated
using (
  public.is_birdshop_admin()
)
with check (
  public.is_birdshop_admin()
);

drop policy if exists
"BirdShop admins manage order items"
on public.order_items;

create policy
"BirdShop admins manage order items"
on public.order_items
for all
to authenticated
using (
  public.is_birdshop_admin()
)
with check (
  public.is_birdshop_admin()
);

drop policy if exists
"BirdShop admins manage fulfillments"
on public.order_fulfillments;

create policy
"BirdShop admins manage fulfillments"
on public.order_fulfillments
for all
to authenticated
using (
  public.is_birdshop_admin()
)
with check (
  public.is_birdshop_admin()
);

revoke all on public.orders from anon;
revoke all on public.order_items from anon;
revoke all on public.order_fulfillments from anon;

grant select, insert, update, delete
on public.orders
to authenticated, service_role;

grant select, insert, update, delete
on public.order_items
to authenticated, service_role;

grant select, insert, update, delete
on public.order_fulfillments
to authenticated, service_role;

-- =========================================================
-- ADMIN TEST PRODUCT ORDER
-- =========================================================

create or replace function public.birdshop_admin_create_test_order(
  p_customer_name text,
  p_customer_email text,
  p_product_id uuid,
  p_quantity integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_order_id uuid;
begin
  if
    coalesce(auth.role(), '') <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception 'Not authorized.';
  end if;

  if p_quantity < 1 or p_quantity > 25 then
    raise exception 'Quantity must be between 1 and 25.';
  end if;

  select *
  into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found.';
  end if;

  if v_product.stock < p_quantity then
    raise exception
      'Not enough stock. Only % available.',
      v_product.stock;
  end if;

  insert into public.orders (
    reference,
    customer_name,
    customer_email,
    source,
    notes
  )
  values (
    '',
    trim(p_customer_name),
    lower(trim(p_customer_email)),
    'admin_test',
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id
  into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_slug,
    product_name,
    product_platform,
    product_region,
    unit_price,
    quantity,
    line_total
  )
  values (
    v_order_id,
    v_product.id,
    v_product.slug,
    v_product.name,
    v_product.platform,
    v_product.region,
    v_product.price,
    p_quantity,
    round((v_product.price * p_quantity)::numeric, 2)
  );

  return v_order_id;
end;
$$;

-- =========================================================
-- RESERVE INVENTORY
-- =========================================================

create or replace function public.birdshop_reserve_order_inventory(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_inventory_ids uuid[];
  v_found integer;
  v_requires_keys boolean := false;
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

  if v_order.payment_status <> 'paid' then
    raise exception 'Order must be paid before inventory can be reserved.';
  end if;

  if v_order.order_status = 'cancelled' then
    raise exception 'Cancelled orders cannot reserve inventory.';
  end if;

  if v_order.fulfillment_status = 'fulfilled' then
    return;
  end if;

  if v_order.fulfillment_status = 'reserved' then
    return;
  end if;

  for v_item in
    select
      oi.id,
      oi.product_id,
      oi.product_name,
      oi.quantity,
      p.inventory_mode
    from public.order_items oi
    left join public.products p
      on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    if
      v_item.product_id is not null
      and v_item.inventory_mode = 'keys'
    then
      v_requires_keys := true;
      v_inventory_ids := null;

      select array_agg(locked_inventory.id)
      into v_inventory_ids
      from (
        select pi.id
        from public.product_inventory pi
        where
          pi.product_id = v_item.product_id
          and pi.status = 'available'
        order by pi.created_at asc
        limit v_item.quantity
        for update skip locked
      ) locked_inventory;

      v_found :=
        coalesce(
          cardinality(v_inventory_ids),
          0
        );

      if v_found < v_item.quantity then
        raise exception
          'Not enough available keys for %. Needed %, found %.',
          v_item.product_name,
          v_item.quantity,
          v_found;
      end if;

      update public.product_inventory
      set
        status = 'reserved',
        reserved_reference = v_order.reference,
        reserved_at = coalesce(reserved_at, now()),
        updated_at = now()
      where id = any(v_inventory_ids);

      insert into public.order_fulfillments (
        order_id,
        order_item_id,
        product_inventory_id
      )
      select
        p_order_id,
        v_item.id,
        inventory_id
      from unnest(v_inventory_ids) as inventory_id;
    end if;
  end loop;

  update public.orders
  set
    fulfillment_status =
      case
        when v_requires_keys then 'reserved'
        else 'unfulfilled'
      end
  where id = p_order_id;
end;
$$;

-- =========================================================
-- RELEASE RESERVED INVENTORY
-- =========================================================

create or replace function public.birdshop_release_order_inventory(
  p_order_id uuid
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

  update public.product_inventory pi
  set
    status = 'available',
    reserved_reference = null,
    reserved_at = null,
    updated_at = now()
  where
    pi.status = 'reserved'
    and pi.id in (
      select ofu.product_inventory_id
      from public.order_fulfillments ofu
      where
        ofu.order_id = p_order_id
        and ofu.delivered_at is null
    );

  delete from public.order_fulfillments
  where
    order_id = p_order_id
    and delivered_at is null;

  update public.orders
  set fulfillment_status = 'unfulfilled'
  where
    id = p_order_id
    and fulfillment_status <> 'fulfilled';
end;
$$;

-- =========================================================
-- MARK PAID + RESERVE
-- =========================================================

create or replace function public.birdshop_mark_paid_and_reserve(
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

  if v_order.order_status = 'cancelled' then
    raise exception 'Cancelled orders cannot be marked paid.';
  end if;

  update public.orders
  set
    payment_status = 'paid',
    order_status = 'active',
    paid_at = coalesce(paid_at, now())
  where id = p_order_id;

  perform public.birdshop_reserve_order_inventory(p_order_id);
end;
$$;

-- =========================================================
-- FULFILL ORDER
-- =========================================================

create or replace function public.birdshop_fulfill_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_required_keys integer;
  v_assigned_keys integer;
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

  if v_order.payment_status <> 'paid' then
    raise exception 'Order must be paid before fulfillment.';
  end if;

  if v_order.order_status = 'cancelled' then
    raise exception 'Cancelled orders cannot be fulfilled.';
  end if;

  if v_order.fulfillment_status = 'fulfilled' then
    return;
  end if;

  if v_order.fulfillment_status <> 'reserved' then
    perform public.birdshop_reserve_order_inventory(p_order_id);
  end if;

  select
    coalesce(sum(oi.quantity), 0)
  into v_required_keys
  from public.order_items oi
  join public.products p
    on p.id = oi.product_id
  where
    oi.order_id = p_order_id
    and p.inventory_mode = 'keys';

  select count(*)
  into v_assigned_keys
  from public.order_fulfillments
  where order_id = p_order_id;

  if v_assigned_keys < v_required_keys then
    raise exception
      'Order does not have enough reserved inventory.';
  end if;

  update public.product_inventory pi
  set
    status = 'sold',
    sold_at = coalesce(sold_at, now()),
    updated_at = now()
  where
    pi.id in (
      select ofu.product_inventory_id
      from public.order_fulfillments ofu
      where ofu.order_id = p_order_id
    )
    and pi.status = 'reserved';

  update public.order_fulfillments
  set delivered_at = coalesce(delivered_at, now())
  where order_id = p_order_id;

  update public.orders
  set
    order_status = 'completed',
    fulfillment_status = 'fulfilled',
    fulfilled_at = coalesce(fulfilled_at, now())
  where id = p_order_id;
end;
$$;

-- =========================================================
-- CANCEL ORDER
-- =========================================================

create or replace function public.birdshop_cancel_order(
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

  if v_order.fulfillment_status = 'fulfilled' then
    raise exception 'Fulfilled orders cannot be cancelled.';
  end if;

  perform public.birdshop_release_order_inventory(p_order_id);

  update public.orders
  set
    order_status = 'cancelled',
    payment_status =
      case
        when payment_status = 'pending' then 'cancelled'
        else payment_status
      end,
    fulfillment_status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, now())
  where id = p_order_id;
end;
$$;

-- =========================================================
-- FUNCTION PERMISSIONS
-- =========================================================

revoke all
on function public.birdshop_admin_create_test_order(
  text,
  text,
  uuid,
  integer,
  text
)
from public, anon;

grant execute
on function public.birdshop_admin_create_test_order(
  text,
  text,
  uuid,
  integer,
  text
)
to authenticated, service_role;

revoke all
on function public.birdshop_reserve_order_inventory(uuid)
from public, anon;

grant execute
on function public.birdshop_reserve_order_inventory(uuid)
to authenticated, service_role;

revoke all
on function public.birdshop_release_order_inventory(uuid)
from public, anon;

grant execute
on function public.birdshop_release_order_inventory(uuid)
to authenticated, service_role;

revoke all
on function public.birdshop_mark_paid_and_reserve(uuid)
from public, anon;

grant execute
on function public.birdshop_mark_paid_and_reserve(uuid)
to authenticated, service_role;

revoke all
on function public.birdshop_fulfill_order(uuid)
from public, anon;

grant execute
on function public.birdshop_fulfill_order(uuid)
to authenticated, service_role;

revoke all
on function public.birdshop_cancel_order(uuid)
from public, anon;

grant execute
on function public.birdshop_cancel_order(uuid)
to authenticated, service_role;
