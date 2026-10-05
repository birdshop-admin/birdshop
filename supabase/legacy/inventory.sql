-- =========================================================
-- BIRDSHOP SECURE DIGITAL INVENTORY
-- Run this AFTER the existing products/admin_users setup.
-- =========================================================

create schema if not exists private;

-- =========================================================
-- PRODUCTS: INVENTORY MODE
-- manual = products.stock is managed manually
-- keys   = products.stock is derived from available keys
-- =========================================================

alter table public.products
add column if not exists inventory_mode text
not null
default 'manual';

alter table public.products
drop constraint if exists products_inventory_mode_check;

alter table public.products
add constraint products_inventory_mode_check
check (
  inventory_mode in ('manual', 'keys')
);

-- =========================================================
-- DIGITAL KEY INVENTORY
-- The actual code is encrypted in Next.js before insertion.
-- code_hash prevents duplicate codes without storing plaintext.
-- =========================================================

create table if not exists public.product_inventory (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  code_ciphertext text not null,
  code_hash text not null unique,
  code_hint text not null,

  status text not null default 'available'
    check (
      status in (
        'available',
        'reserved',
        'sold',
        'disabled'
      )
    ),

  note text,

  reserved_reference text,
  reserved_at timestamptz,
  sold_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
product_inventory_product_status_idx
on public.product_inventory(product_id, status);

create index if not exists
product_inventory_created_at_idx
on public.product_inventory(created_at desc);

-- =========================================================
-- UPDATED AT
-- =========================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists
product_inventory_set_updated_at
on public.product_inventory;

create trigger product_inventory_set_updated_at
before update
on public.product_inventory
for each row
execute function private.set_updated_at();

-- =========================================================
-- STOCK SYNC
-- =========================================================

create or replace function private.sync_inventory_stock(
  target_product uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products
  set stock = (
    select count(*)::integer
    from public.product_inventory
    where product_id = target_product
      and status = 'available'
  )
  where id = target_product
    and inventory_mode = 'keys';
end;
$$;

create or replace function private.product_inventory_stock_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_inventory_stock(old.product_id);
    return old;
  end if;

  perform private.sync_inventory_stock(new.product_id);

  if tg_op = 'UPDATE'
    and old.product_id is distinct from new.product_id then
    perform private.sync_inventory_stock(old.product_id);
  end if;

  return new;
end;
$$;

drop trigger if exists
product_inventory_stock_sync
on public.product_inventory;

create trigger product_inventory_stock_sync
after insert or update or delete
on public.product_inventory
for each row
execute function private.product_inventory_stock_trigger();

-- If a product is in key-managed mode, direct stock edits are
-- automatically replaced by the real number of available keys.
create or replace function private.enforce_key_managed_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.inventory_mode = 'keys' then
    new.stock = (
      select count(*)::integer
      from public.product_inventory
      where product_id = new.id
        and status = 'available'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists
products_enforce_key_managed_stock
on public.products;

create trigger products_enforce_key_managed_stock
before insert or update of stock, inventory_mode
on public.products
for each row
execute function private.enforce_key_managed_stock();

-- =========================================================
-- RLS / PRIVILEGES
-- =========================================================

alter table public.product_inventory
enable row level security;

revoke all
on table public.product_inventory
from anon, authenticated;

grant select, insert, update, delete
on table public.product_inventory
to authenticated;

drop policy if exists
"Admins can read inventory"
on public.product_inventory;

drop policy if exists
"Admins can create inventory"
on public.product_inventory;

drop policy if exists
"Admins can update inventory"
on public.product_inventory;

drop policy if exists
"Admins can delete inventory"
on public.product_inventory;

create policy
"Admins can read inventory"
on public.product_inventory
for select
to authenticated
using (
  (select private.is_admin())
);

create policy
"Admins can create inventory"
on public.product_inventory
for insert
to authenticated
with check (
  (select private.is_admin())
);

create policy
"Admins can update inventory"
on public.product_inventory
for update
to authenticated
using (
  (select private.is_admin())
)
with check (
  (select private.is_admin())
);

create policy
"Admins can delete inventory"
on public.product_inventory
for delete
to authenticated
using (
  (select private.is_admin())
);

-- Make sure existing key-managed products (if any) are synced.
do $$
declare
  product_record record;
begin
  for product_record in
    select id
    from public.products
    where inventory_mode = 'keys'
  loop
    perform private.sync_inventory_stock(product_record.id);
  end loop;
end;
$$;
