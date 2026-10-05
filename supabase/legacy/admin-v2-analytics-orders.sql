-- =========================================================
-- BIRDSHOP ADMIN V2
-- Service-first orders + archiving + first-party analytics.
-- Safe to re-run after supabase/orders.sql.
-- =========================================================

-- =========================================================
-- ORDER TYPE / SERVICE WORKFLOW
-- =========================================================

alter table public.orders
add column if not exists order_type text
not null
default 'product';

alter table public.orders
drop constraint if exists orders_order_type_check;

alter table public.orders
add constraint orders_order_type_check
check (
  order_type in (
    'product',
    'service'
  )
);

alter table public.orders
add column if not exists service_slug text;

alter table public.orders
add column if not exists service_name text;

alter table public.orders
add column if not exists package_name text;

alter table public.orders
add column if not exists package_price numeric(12, 2);

alter table public.orders
add column if not exists service_status text;

alter table public.orders
add column if not exists assigned_to text;

alter table public.orders
add column if not exists archived_at timestamptz;

alter table public.orders
drop constraint if exists orders_service_status_check;

alter table public.orders
add constraint orders_service_status_check
check (
  service_status is null
  or service_status in (
    'new',
    'assigned',
    'in_progress',
    'waiting_customer',
    'completed',
    'cancelled'
  )
);

create index if not exists orders_order_type_idx
on public.orders(order_type);

create index if not exists orders_service_status_idx
on public.orders(service_status);

create index if not exists orders_archived_at_idx
on public.orders(archived_at);

-- =========================================================
-- CREATE TEST SERVICE ORDER
-- =========================================================

create or replace function
public.birdshop_admin_create_test_service_order(
  p_customer_name text,
  p_customer_email text,
  p_service_name text,
  p_package_name text,
  p_price numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if
    coalesce(auth.role(), '') <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception 'Not authorized.';
  end if;

  if trim(coalesce(p_customer_name, '')) = '' then
    raise exception 'Customer name is required.';
  end if;

  if trim(coalesce(p_customer_email, '')) = '' then
    raise exception 'Customer email is required.';
  end if;

  if trim(coalesce(p_service_name, '')) = '' then
    raise exception 'Service name is required.';
  end if;

  if p_price < 0 then
    raise exception 'Price cannot be negative.';
  end if;

  insert into public.orders (
    reference,
    customer_name,
    customer_email,
    order_type,
    service_name,
    package_name,
    package_price,
    service_status,
    order_status,
    payment_status,
    fulfillment_status,
    subtotal,
    total,
    source,
    notes
  )
  values (
    '',
    trim(p_customer_name),
    lower(trim(p_customer_email)),
    'service',
    trim(p_service_name),
    nullif(trim(coalesce(p_package_name, '')), ''),
    p_price,
    'new',
    'pending',
    'pending',
    'unfulfilled',
    p_price,
    p_price,
    'admin_test',
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id
  into v_order_id;

  return v_order_id;
end;
$$;

-- =========================================================
-- SERVICE WORKFLOW
-- =========================================================

create or replace function
public.birdshop_set_service_order_status(
  p_order_id uuid,
  p_status text,
  p_assigned_to text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_assigned text;
begin
  if
    coalesce(auth.role(), '') <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception 'Not authorized.';
  end if;

  if p_status not in (
    'new',
    'assigned',
    'in_progress',
    'waiting_customer',
    'completed',
    'cancelled'
  ) then
    raise exception 'Invalid service status.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.order_type <> 'service' then
    raise exception 'This is not a service order.';
  end if;

  v_assigned := nullif(trim(coalesce(p_assigned_to, '')), '');

  if
    p_status = 'assigned'
    and coalesce(v_assigned, v_order.assigned_to) is null
  then
    raise exception 'Assign an admin before using Assigned status.';
  end if;

  if
    p_status = 'completed'
    and v_order.source <> 'admin_test'
    and v_order.payment_status <> 'paid'
  then
    raise exception 'A real service order must be paid before completion.';
  end if;

  update public.orders
  set
    service_status = p_status,

    assigned_to =
      case
        when v_assigned is null then assigned_to
        else v_assigned
      end,

    order_status =
      case
        when p_status = 'completed' then 'completed'
        when p_status = 'cancelled' then 'cancelled'
        when payment_status = 'paid' then 'active'
        else order_status
      end,

    fulfillment_status =
      case
        when p_status = 'completed' then 'fulfilled'
        when p_status = 'cancelled' then 'cancelled'
        else fulfillment_status
      end,

    fulfilled_at =
      case
        when p_status = 'completed' then coalesce(fulfilled_at, now())
        else fulfilled_at
      end,

    cancelled_at =
      case
        when p_status = 'cancelled' then coalesce(cancelled_at, now())
        else cancelled_at
      end
  where id = p_order_id;
end;
$$;

-- =========================================================
-- DELETE TEST ORDER
-- Restores inventory consumed by an admin test purchase.
-- =========================================================

create or replace function
public.birdshop_delete_test_order(
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

  if v_order.source <> 'admin_test' then
    raise exception 'Only admin test orders can be permanently deleted.';
  end if;

  update public.product_inventory pi
  set
    status = 'available',
    reserved_reference = null,
    reserved_at = null,
    sold_at = null,
    updated_at = now()
  where pi.id in (
    select ofu.product_inventory_id
    from public.order_fulfillments ofu
    where ofu.order_id = p_order_id
  )
  and pi.status in (
    'reserved',
    'sold'
  );

  delete from public.orders
  where id = p_order_id;
end;
$$;

-- =========================================================
-- ARCHIVE / RESTORE REAL ORDERS
-- =========================================================

create or replace function
public.birdshop_archive_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
begin
  if
    coalesce(auth.role(), '') <> 'service_role'
    and not public.is_birdshop_admin()
  then
    raise exception 'Not authorized.';
  end if;

  select source
  into v_source
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_source = 'admin_test' then
    raise exception 'Test orders should be deleted instead of archived.';
  end if;

  update public.orders
  set archived_at = now()
  where id = p_order_id;
end;
$$;

create or replace function
public.birdshop_unarchive_order(
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

  update public.orders
  set archived_at = null
  where id = p_order_id;
end;
$$;

-- =========================================================
-- FIRST-PARTY WEBSITE ANALYTICS
-- No name, email or IP address is stored.
-- A random browser identifier is used for approximate visitors.
-- =========================================================

create table if not exists public.site_sessions (
  session_id uuid primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  first_path text not null default '/',
  last_path text not null default '/'
);

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists site_sessions_last_seen_idx
on public.site_sessions(last_seen desc);

create index if not exists page_views_created_at_idx
on public.page_views(created_at desc);

create index if not exists page_views_session_id_idx
on public.page_views(session_id);

alter table public.site_sessions
enable row level security;

alter table public.page_views
enable row level security;

revoke all
on public.site_sessions
from anon, authenticated;

revoke all
on public.page_views
from anon, authenticated;

create or replace function
public.birdshop_track_activity(
  p_session_id uuid,
  p_path text,
  p_record_view boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  v_path :=
    left(
      coalesce(
        nullif(trim(p_path), ''),
        '/'
      ),
      300
    );

  insert into public.site_sessions (
    session_id,
    first_seen,
    last_seen,
    first_path,
    last_path
  )
  values (
    p_session_id,
    now(),
    now(),
    v_path,
    v_path
  )
  on conflict (session_id)
  do update
  set
    last_seen = now(),
    last_path = excluded.last_path;

  if p_record_view then
    insert into public.page_views (
      session_id,
      path
    )
    values (
      p_session_id,
      v_path
    );
  end if;
end;
$$;

create or replace function
public.birdshop_admin_site_analytics()
returns table (
  online_now bigint,
  views_7d bigint,
  views_30d bigint,
  views_all bigint,
  visitors_7d bigint,
  visitors_30d bigint,
  visitors_all bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_birdshop_admin() then
    raise exception 'Not authorized.';
  end if;

  return query
  select
    (
      select count(*)
      from public.site_sessions
      where last_seen >= now() - interval '2 minutes'
    ),
    (
      select count(*)
      from public.page_views
      where created_at >= now() - interval '7 days'
    ),
    (
      select count(*)
      from public.page_views
      where created_at >= now() - interval '30 days'
    ),
    (
      select count(*)
      from public.page_views
    ),
    (
      select count(distinct session_id)
      from public.page_views
      where created_at >= now() - interval '7 days'
    ),
    (
      select count(distinct session_id)
      from public.page_views
      where created_at >= now() - interval '30 days'
    ),
    (
      select count(distinct session_id)
      from public.page_views
    );
end;
$$;

-- =========================================================
-- PUBLIC VERIFIED PRODUCT-SOLD COUNTER
-- Archiving is administrative only and does not remove a sale.
-- =========================================================

create or replace function
public.birdshop_public_store_stats()
returns table (
  products_sold bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      sum(oi.quantity),
      0
    )::bigint
  from public.orders o
  join public.order_items oi
    on oi.order_id = o.id
  where
    o.order_type = 'product'
    and o.source <> 'admin_test'
    and o.payment_status = 'paid'
    and o.fulfillment_status = 'fulfilled'
    and o.order_status = 'completed';
$$;

-- =========================================================
-- PERMISSIONS
-- =========================================================

revoke all
on function public.birdshop_admin_create_test_service_order(
  text,
  text,
  text,
  text,
  numeric,
  text
)
from public, anon;

grant execute
on function public.birdshop_admin_create_test_service_order(
  text,
  text,
  text,
  text,
  numeric,
  text
)
to authenticated, service_role;

revoke all
on function public.birdshop_set_service_order_status(
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function public.birdshop_set_service_order_status(
  uuid,
  text,
  text
)
to authenticated, service_role;

revoke all
on function public.birdshop_delete_test_order(uuid)
from public, anon;

grant execute
on function public.birdshop_delete_test_order(uuid)
to authenticated, service_role;

revoke all
on function public.birdshop_archive_order(uuid)
from public, anon;

grant execute
on function public.birdshop_archive_order(uuid)
to authenticated, service_role;

revoke all
on function public.birdshop_unarchive_order(uuid)
from public, anon;

grant execute
on function public.birdshop_unarchive_order(uuid)
to authenticated, service_role;

revoke all
on function public.birdshop_track_activity(
  uuid,
  text,
  boolean
)
from public;

grant execute
on function public.birdshop_track_activity(
  uuid,
  text,
  boolean
)
to anon, authenticated;

revoke all
on function public.birdshop_admin_site_analytics()
from public, anon;

grant execute
on function public.birdshop_admin_site_analytics()
to authenticated, service_role;

revoke all
on function public.birdshop_public_store_stats()
from public;

grant execute
on function public.birdshop_public_store_stats()
to anon, authenticated, service_role;
