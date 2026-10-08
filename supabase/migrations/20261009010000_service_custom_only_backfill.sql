-- BirdShop · mark the seeded custom-request services as "Custom quote only".
--
-- Requires 20261008090000_custom_only_services.sql (package checkout refuses
-- custom-only services). Apply after 20261008120000_production_readiness.sql.
--
-- Idempotent and non-destructive:
--   * only the three seeded services that are custom requests by nature
--     (custom-build-request, custom-game-service, roblox-custom-task);
--   * only while the owner has never chosen a pricing type for them: every
--     admin save writes the customOnly key, so an explicit choice (true or
--     false) is never overridden, and re-running changes nothing;
--   * packages, prices, images and every other data key are left untouched.
--
-- No schema, grant or storage change is needed for service images:
--   * birdshop_services.data is free-form jsonb (only jsonb_typeof = 'object'
--     is checked; no key whitelist), written by the service-role admin action;
--   * images live in the existing public-read "product-images" bucket under
--     services/<slug>/, and the owner-only insert/update/delete policies
--     (20261005020100, 20261008120000) cover the whole bucket with no path
--     restriction; the restrictive birdshop_gallery_restrict_* policies only
--     block non-owners.

begin;

do $$
declare
  checkout regprocedure := to_regprocedure(
    'public.birdshop_begin_package_checkout(uuid,text,text,text,text,bigint,text)'
  );
begin
  if checkout is null or pg_get_functiondef(checkout) not like '%customOnly%' then
    raise exception
      'Apply 20261008090000_custom_only_services.sql before this migration.';
  end if;
end $$;

update public.birdshop_services
set
  data = data || jsonb_build_object('customOnly', true),
  updated_at = now()
where slug in ('custom-build-request', 'custom-game-service', 'roblox-custom-task')
  and deleted_at is null
  and not (data ? 'customOnly');

commit;
