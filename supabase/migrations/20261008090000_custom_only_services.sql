begin;

-- Requires the paid-service-packages migration. Existing attempts retain their agreed scope.
create or replace function public.birdshop_begin_package_checkout(
 p_request_id uuid,p_slug text,p_tier text,p_name text,p_email text,
 p_expected_cents bigint,p_access_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.birdshop_services%rowtype; pack jsonb;
 a public.birdshop_checkout_attempts%rowtype; saved public.birdshop_package_checkouts%rowtype;
 f jsonb; description text;
begin
 perform private.birdshop_require_server();
 if p_request_id is null or p_tier is null or p_tier not in ('starter','standard','premium')
 or p_name is null or length(trim(p_name)) not between 2 and 100
 or p_email is null or length(p_email)>320 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or p_access_hash is null or p_access_hash !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid purchase.'; end if;
 f:=jsonb_build_object('slug',p_slug,'tier',p_tier,'name',trim(p_name),
 'email',lower(trim(p_email)),'cents',p_expected_cents);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,9));
 -- Do not turn a retry of a historical purchase into a second payment.
 if exists(select 1 from public.birdshop_service_purchases where request_id=p_request_id)
 then raise exception 'Historical purchase: check its original payment before starting again.'; end if;
 select * into a from public.birdshop_checkout_attempts where id=p_request_id for update;
 if found then
   select * into saved from public.birdshop_package_checkouts where attempt_id=a.id;
   if not found or a.kind<>'package' or a.access_hash is distinct from p_access_hash
      or saved.fingerprint is distinct from f then raise exception 'Purchase does not match.'; end if;
   return to_jsonb(a);
 end if;
 select * into s from public.birdshop_services
 where slug=p_slug and is_visible and deleted_at is null for share;
 if not found or not coalesce((s.data->>'available')::boolean,false)
 or coalesce((s.data->>'customOnly')::boolean,false)
 then raise exception 'Service unavailable.'; end if;
 select x into pack from jsonb_array_elements(s.packages) x
 where x->>'id'=p_tier and x->>'enabled'='true';
 if pack is null or (pack->>'cents')::bigint not between 50 and 99999999
 or length(trim(pack->>'scope'))<5 or p_expected_cents is null
 or p_expected_cents is distinct from (pack->>'cents')::bigint
 then raise exception 'Package or price changed. Refresh before purchasing.'; end if;
 description:=left((pack->>'scope')||E'\nIncluded: '||coalesce(
 (select string_agg(value,E'\n') from jsonb_array_elements_text(pack->'includes')),''),4000);
 insert into public.birdshop_checkout_attempts(id,kind,expected_cents,customer_name,customer_email,access_hash,cart)
 values(p_request_id,'package',p_expected_cents,trim(p_name),lower(trim(p_email)),p_access_hash,
 jsonb_build_array(jsonb_build_object('id',p_request_id,'slug',p_slug,
 'name',left((s.data->>'name')||' — '||(pack->>'name'),180),
 'quantity',1,'unit_cents',p_expected_cents,'line_cents',p_expected_cents))) returning * into a;
 insert into public.birdshop_package_checkouts(attempt_id,fingerprint,service_slug,service_name,tier_id,tier_name,description)
 values(a.id,f,p_slug,s.data->>'name',p_tier,pack->>'name',description);
 return to_jsonb(a);
end $$;


commit;
