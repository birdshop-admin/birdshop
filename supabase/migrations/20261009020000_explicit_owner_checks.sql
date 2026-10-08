-- BirdShop: explicit owner checks on the two order-deletion wrappers.
-- Both already delegated to private.birdshop_cleanup_order, which rejects
-- non-owners. Repeating the check here keeps each browser-callable function
-- self-evidently safe and protects it if the private helper is ever changed.
-- Same signatures, return types and grants; no data is touched.
begin;

create or replace function public.birdshop_permanently_delete_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_birdshop_owner() then
    raise exception 'Active owner required.';
  end if;
  perform private.birdshop_cleanup_order(p_order_id, false);
end $$;

create or replace function public.birdshop_delete_test_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_birdshop_owner() then
    raise exception 'Active owner required.';
  end if;
  perform private.birdshop_cleanup_order(p_order_id, true);
end $$;

revoke all on function public.birdshop_permanently_delete_order(uuid), public.birdshop_delete_test_order(uuid) from public, anon;
grant execute on function public.birdshop_permanently_delete_order(uuid), public.birdshop_delete_test_order(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
