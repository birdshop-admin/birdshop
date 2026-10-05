begin;
CREATE OR REPLACE FUNCTION public.birdshop_track_activity(p_session_id uuid, p_path text, p_record_view boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_path text;
begin
  perform private.birdshop_require_server();
  v_path :=
    left(
      coalesce(
        nullif(
          trim(p_path),
          ''
        ),
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
  on conflict (
    session_id
  )
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
$function$;

revoke execute on function public.birdshop_track_activity(uuid,text,boolean) from public,anon,authenticated;

grant execute on function public.birdshop_track_activity(uuid,text,boolean) to service_role;

CREATE OR REPLACE FUNCTION public.submit_review(p_type text, p_reviewer text, p_contact_handle text, p_rating integer, p_title text, p_body text, p_subject_slug text, p_subject text, p_meta text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reference text;
  v_reviewer text;
  v_initials text;
begin
  perform private.birdshop_require_server();
  if p_type is null or p_rating is null then raise exception 'Review type and rating required.'; end if;
  if p_type not in ('Product', 'Service') then
    raise exception 'Unsupported review type.';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  if length(trim(coalesce(p_contact_handle, ''))) < 2 then
    raise exception 'Contact information is required.';
  end if;

  if length(trim(coalesce(p_title, ''))) < 4 then
    raise exception 'Please add a short review headline.';
  end if;

  if length(trim(coalesce(p_body, ''))) < 10 then
    raise exception 'Please add a little more detail to your review.';
  end if;

  if length(p_contact_handle) > 240
    or length(coalesce(p_reviewer, '')) > 120
    or length(p_title) > 180
    or length(p_body) > 5000
    or length(coalesce(p_subject, '')) > 220
    or length(coalesce(p_meta, '')) > 220 then
    raise exception 'One or more review fields are too long.';
  end if;

  v_reviewer := coalesce(
    nullif(trim(coalesce(p_reviewer, '')), ''),
    'Anonymous'
  );

  v_initials := upper(
    left(split_part(v_reviewer, ' ', 1), 1) ||
    left(split_part(v_reviewer, ' ', 2), 1)
  );

  if length(v_initials) < 2 then
    v_initials := upper(
      left(
        regexp_replace(v_reviewer, '[^A-Za-z0-9]', '', 'g'),
        2
      )
    );
  end if;

  if length(v_initials) = 0 then
    v_initials := 'AN';
  end if;

  insert into public.reviews (
    status,
    type,
    reviewer,
    initials,
    contact_handle,
    rating,
    title,
    body,
    subject_slug,
    subject,
    meta,
    featured
  )
  values (
    'pending',
    p_type,
    v_reviewer,
    v_initials,
    trim(p_contact_handle),
    p_rating,
    trim(p_title),
    trim(p_body),
    nullif(trim(coalesce(p_subject_slug, '')), ''),
    trim(p_subject),
    trim(coalesce(p_meta, '')),
    false
  )
  returning reference into v_reference;

  return v_reference;
end;
$function$
;
revoke execute on function public.submit_review(text,text,text,integer,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_review(text,text,text,integer,text,text,text,text,text) to service_role;

-- Diagnostic data is whitelisted by the server; no token-bearing tables get browser SELECT.
create or replace function public.birdshop_v2_admin_health() returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.'; end if;
 return jsonb_build_object(
  'email_jobs',(select coalesce(jsonb_agg(x),'[]') from (select id,kind,status,attempts,last_error,created_at,sent_at,provider_id from public.birdshop_email_jobs order by created_at desc limit 50)x),
  'pending_events',(select count(*) from public.birdshop_stripe_events where processed_at is null),
  'checkouts_needing_attention',(select count(*) from public.birdshop_checkout_attempts where status='attention'),
  'checkouts',(select coalesce(jsonb_agg(x),'[]') from (select id,kind,status,stripe_session_id,created_at,expires_at from public.birdshop_checkout_attempts where status in ('creating','open','processing','attention') order by created_at limit 50)x),
  'audit',(select coalesce(jsonb_agg(x),'[]') from (select action,entity_id,actor_id,created_at from public.birdshop_audit_log order by created_at desc limit 30)x));
end $$;


create or replace function public.birdshop_public_store_stats() returns table(products_sold bigint)
language sql stable security definer set search_path='' as $$
 select coalesce(sum(i.quantity),0)::bigint from public.orders o join public.order_items i on i.order_id=o.id
 where o.order_type='product' and o.source<>'admin_test' and o.paid_at is not null and o.payment_status in ('paid','partially_refunded','refunded')
$$;
create or replace function public.birdshop_v2_sales_stats() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.';end if;
 select coalesce(jsonb_agg(stats),'[]') into result from (
 select currency,sum(total) gross_revenue,sum(refunded_amount) refunds,sum(total-refunded_amount) net_revenue,count(*) paid_orders,
 coalesce(sum(total-refunded_amount) filter(where paid_at>=now()-interval '7 days'),0) net_7d,
 coalesce(sum(total-refunded_amount) filter(where paid_at>=now()-interval '30 days'),0) net_30d,
 coalesce(sum(total-refunded_amount) filter(where order_type='product'),0) product_net_revenue,
 coalesce(sum(total-refunded_amount) filter(where order_type='service'),0) service_net_revenue
 from public.orders where source<>'admin_test' and paid_at is not null and payment_status in ('paid','partially_refunded','refunded') group by currency order by currency)stats;
 return result;
end $$;
create function public.birdshop_v2_analytics_series(p_days integer default 30) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if not public.is_birdshop_owner() then raise exception 'Active owner required.';end if;
 if p_days not in (7,30,90) then raise exception 'Invalid period.';end if;
 select coalesce(jsonb_agg(x order by x.day),'[]') into result from (
 select d::date as day,
 (select count(*) from public.page_views where created_at>=d and created_at<d+interval '1 day') views,
 (select count(*) from public.orders where source<>'admin_test' and paid_at>=d and paid_at<d+interval '1 day' and payment_status in ('paid','partially_refunded','refunded')) paid_orders,
 (select coalesce(sum(i.quantity),0) from public.order_items i join public.orders o on o.id=i.order_id where o.order_type='product' and o.source<>'admin_test' and o.paid_at>=d and o.paid_at<d+interval '1 day' and o.payment_status in ('paid','partially_refunded','refunded')) units
 from generate_series(date_trunc('day',now() at time zone 'UTC')-make_interval(days=>p_days-1),date_trunc('day',now() at time zone 'UTC'),interval '1 day') d)x;
 return result;
end $$;
-- Metadata-only auditing for catalog and inventory operations. No encrypted or raw codes.
create function private.birdshop_catalog_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare row_id uuid; action_name text;begin
 row_id:=case when tg_op='DELETE' then old.id else new.id end;
 action_name:=tg_table_name||'_'||lower(tg_op);
 insert into public.birdshop_audit_log(actor_id,action,entity_id,details) values(coalesce(auth.uid(),case when tg_table_name='product_inventory' and tg_op='INSERT' then (to_jsonb(new)->>'created_by')::uuid end),action_name,row_id,
 case when tg_table_name='product_inventory' then jsonb_build_object('status',case when tg_op='DELETE' then to_jsonb(old)->>'status' else to_jsonb(new)->>'status' end) else '{}'::jsonb end);
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger birdshop_catalog_audit after insert or update or delete on public.products for each row execute function private.birdshop_catalog_audit();
create trigger birdshop_catalog_audit after insert or update or delete on public.product_inventory for each row execute function private.birdshop_catalog_audit();
revoke all on function private.birdshop_catalog_audit() from public,anon,authenticated;
revoke all on function public.birdshop_v2_sales_stats(),public.birdshop_v2_admin_health(),public.birdshop_v2_analytics_series(integer) from public,anon;
grant execute on function public.birdshop_v2_sales_stats(),public.birdshop_v2_admin_health(),public.birdshop_v2_analytics_series(integer) to authenticated,service_role;
grant execute on function public.birdshop_public_store_stats() to anon,authenticated,service_role;
revoke select on public.product_inventory from authenticated;
grant select (id,product_id,code_hint,status,note,reserved_reference,reserved_at,sold_at,created_by,created_at,updated_at) on public.product_inventory to authenticated;
CREATE OR REPLACE FUNCTION public.birdshop_admin_site_analytics()
 RETURNS TABLE(online_now bigint, views_7d bigint, views_30d bigint, views_all bigint, visitors_7d bigint, visitors_30d bigint, visitors_all bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_birdshop_owner() then
    raise exception 'Not authorized.';
  end if;

  return query
  select
    (
      select count(*)
      from public.site_sessions
      where last_seen >=
        now() - interval '2 minutes'
    ),

    (
      select count(*)
      from public.page_views
      where created_at >=
        now() - interval '7 days'
    ),

    (
      select count(*)
      from public.page_views
      where created_at >=
        now() - interval '30 days'
    ),

    (
      select count(*)
      from public.page_views
    ),

    (
      select count(
        distinct session_id
      )
      from public.page_views
      where created_at >=
        now() - interval '7 days'
    ),

    (
      select count(
        distinct session_id
      )
      from public.page_views
      where created_at >=
        now() - interval '30 days'
    ),

    (
      select count(
        distinct session_id
      )
      from public.page_views
    );
end;
$function$
;
revoke all on function public.birdshop_admin_site_analytics() from public,anon;
grant execute on function public.birdshop_admin_site_analytics() to authenticated,service_role;
revoke insert,update,delete on public.site_sessions,public.page_views from anon,authenticated;
-- Gallery permissions: public reads; only active owners may mutate the product-art bucket.
do $$ begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',true,8388608,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
  execute 'create policy birdshop_gallery_read on storage.objects for select to anon,authenticated using(bucket_id=''product-images'')';
  execute 'create policy birdshop_gallery_owner_insert on storage.objects for insert to authenticated with check(bucket_id=''product-images'' and public.is_birdshop_owner())';
  execute 'create policy birdshop_gallery_owner_update on storage.objects for update to authenticated using(bucket_id=''product-images'' and public.is_birdshop_owner()) with check(bucket_id=''product-images'' and public.is_birdshop_owner())';
  execute 'create policy birdshop_gallery_owner_delete on storage.objects for delete to authenticated using(bucket_id=''product-images'' and public.is_birdshop_owner())';
  execute 'create policy birdshop_gallery_restrict_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>''product-images'' or public.is_birdshop_owner())';
  execute 'create policy birdshop_gallery_restrict_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>''product-images'' or public.is_birdshop_owner()) with check(bucket_id<>''product-images'' or public.is_birdshop_owner())';
  execute 'create policy birdshop_gallery_restrict_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>''product-images'' or public.is_birdshop_owner())';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
