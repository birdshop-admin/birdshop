begin;

-- Allow the trusted backend to look up products and change stock mode.
grant select, update
on table public.products
to service_role;

-- Allow the trusted backend to check duplicates and insert encrypted codes.
grant select, insert
on table public.product_inventory
to service_role;

commit;