-- =========================================================
-- BIRDSHOP SUPPORT + REVIEWS
-- Run this in Supabase SQL Editor.
-- Safe to re-run while developing.
-- =========================================================

create schema if not exists private;

-- Re-create the helper so this script is self-contained.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

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

-- =========================================================
-- SUPPORT REQUESTS
-- =========================================================

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),

  reference text not null unique
    default (
      'BS-' || upper(
        substr(
          replace(gen_random_uuid()::text, '-', ''),
          1,
          8
        )
      )
    ),

  topic text not null
    check (topic in ('service', 'product', 'general')),

  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),

  display_name text,
  contact_handle text not null,
  message text not null,

  general_subject text,
  order_reference text,

  service_slug text,
  service_name text,
  package_id text,
  package_name text,
  package_price numeric(10, 2),

  product_slug text,
  product_name text,
  product_platform text,
  product_region text,

  source text not null default 'website'
    check (source in ('website', 'chat', 'discord', 'admin')),

  chat_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(chat_context) = 'object'),

  assigned_to text,
  assigned_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_requests
  add column if not exists assigned_to text;

alter table public.support_requests
  add column if not exists assigned_at timestamptz;

alter table public.support_requests enable row level security;

revoke all on table public.support_requests from anon, authenticated;

grant select, update, delete
on table public.support_requests
to authenticated;

drop trigger if exists support_requests_set_updated_at
on public.support_requests;

create trigger support_requests_set_updated_at
before update on public.support_requests
for each row
execute function private.set_updated_at();

drop policy if exists "Admins can read support requests"
on public.support_requests;

drop policy if exists "Admins can update support requests"
on public.support_requests;

drop policy if exists "Admins can delete support requests"
on public.support_requests;

create policy "Admins can read support requests"
on public.support_requests
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can update support requests"
on public.support_requests
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete support requests"
on public.support_requests
for delete
to authenticated
using ((select private.is_admin()));

-- =========================================================
-- REVIEWS
-- Public visitors never query this table directly.
-- Approved public reviews are exposed only through the safe
-- get_approved_reviews() function below.
-- =========================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),

  reference text not null unique
    default (
      'RV-' || upper(
        substr(
          replace(gen_random_uuid()::text, '-', ''),
          1,
          8
        )
      )
    ),

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),

  type text not null
    check (type in ('Product', 'Service')),

  reviewer text not null default 'Anonymous',
  initials text not null default 'AN',
  contact_handle text not null,

  rating integer not null
    check (rating between 1 and 5),

  title text not null,
  body text not null,

  subject_slug text,
  subject text not null,
  meta text not null default '',

  featured boolean not null default false,

  assigned_to text,
  assigned_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

alter table public.reviews
  add column if not exists assigned_to text;

alter table public.reviews
  add column if not exists assigned_at timestamptz;

alter table public.reviews enable row level security;

revoke all on table public.reviews from anon, authenticated;

grant select, update, delete
on table public.reviews
to authenticated;

drop trigger if exists reviews_set_updated_at
on public.reviews;

create trigger reviews_set_updated_at
before update on public.reviews
for each row
execute function private.set_updated_at();

drop policy if exists "Admins can read reviews"
on public.reviews;

drop policy if exists "Admins can update reviews"
on public.reviews;

drop policy if exists "Admins can delete reviews"
on public.reviews;

create policy "Admins can read reviews"
on public.reviews
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can update reviews"
on public.reviews
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete reviews"
on public.reviews
for delete
to authenticated
using ((select private.is_admin()));

-- =========================================================
-- PUBLIC SUBMISSION FUNCTIONS
-- The browser can call these without receiving direct table
-- permissions. Status / featured values are fixed here.
-- =========================================================

create or replace function public.submit_support_request(
  p_topic text,
  p_display_name text,
  p_contact_handle text,
  p_message text,
  p_general_subject text default null,
  p_order_reference text default null,
  p_service_slug text default null,
  p_service_name text default null,
  p_package_id text default null,
  p_package_name text default null,
  p_package_price numeric default null,
  p_product_slug text default null,
  p_product_name text default null,
  p_product_platform text default null,
  p_product_region text default null,
  p_chat_context jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
begin
  if p_topic not in ('service', 'product', 'general') then
    raise exception 'Unsupported support topic.';
  end if;

  if length(trim(coalesce(p_contact_handle, ''))) < 2 then
    raise exception 'Contact information is required.';
  end if;

  if length(trim(coalesce(p_message, ''))) < 5 then
    raise exception 'Please provide a little more detail.';
  end if;

  if length(p_contact_handle) > 240
    or length(coalesce(p_display_name, '')) > 120
    or length(p_message) > 6000
    or length(coalesce(p_general_subject, '')) > 180
    or length(coalesce(p_order_reference, '')) > 180
    or length(coalesce(p_chat_context, '{}'::jsonb)::text) > 4000 then
    raise exception 'One or more fields are too long.';
  end if;

  insert into public.support_requests (
    topic,
    status,
    display_name,
    contact_handle,
    message,
    general_subject,
    order_reference,
    service_slug,
    service_name,
    package_id,
    package_name,
    package_price,
    product_slug,
    product_name,
    product_platform,
    product_region,
    source,
    chat_context
  )
  values (
    p_topic,
    'open',
    nullif(trim(coalesce(p_display_name, '')), ''),
    trim(p_contact_handle),
    trim(p_message),
    nullif(trim(coalesce(p_general_subject, '')), ''),
    nullif(trim(coalesce(p_order_reference, '')), ''),
    nullif(trim(coalesce(p_service_slug, '')), ''),
    nullif(trim(coalesce(p_service_name, '')), ''),
    nullif(trim(coalesce(p_package_id, '')), ''),
    nullif(trim(coalesce(p_package_name, '')), ''),
    p_package_price,
    nullif(trim(coalesce(p_product_slug, '')), ''),
    nullif(trim(coalesce(p_product_name, '')), ''),
    nullif(trim(coalesce(p_product_platform, '')), ''),
    nullif(trim(coalesce(p_product_region, '')), ''),
    'website',
    case
      when jsonb_typeof(coalesce(p_chat_context, '{}'::jsonb)) = 'object'
        then coalesce(p_chat_context, '{}'::jsonb)
      else '{}'::jsonb
    end
  )
  returning reference into v_reference;

  return v_reference;
end;
$$;

revoke all on function public.submit_support_request(
  text, text, text, text, text, text,
  text, text, text, text, numeric,
  text, text, text, text, jsonb
) from public;

grant execute on function public.submit_support_request(
  text, text, text, text, text, text,
  text, text, text, text, numeric,
  text, text, text, text, jsonb
) to anon, authenticated;

create or replace function public.submit_review(
  p_type text,
  p_reviewer text,
  p_contact_handle text,
  p_rating integer,
  p_title text,
  p_body text,
  p_subject_slug text,
  p_subject text,
  p_meta text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
  v_reviewer text;
  v_initials text;
begin
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
$$;

revoke all on function public.submit_review(
  text, text, text, integer, text, text, text, text, text
) from public;

grant execute on function public.submit_review(
  text, text, text, integer, text, text, text, text, text
) to anon, authenticated;

-- =========================================================
-- SAFE PUBLIC REVIEW FEED
-- contact_handle, status and moderation data never leave the
-- database through this function.
-- =========================================================

create or replace function public.get_approved_reviews()
returns table (
  id uuid,
  type text,
  reviewer text,
  initials text,
  rating integer,
  title text,
  body text,
  subject text,
  meta text,
  featured boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.type,
    r.reviewer,
    r.initials,
    r.rating,
    r.title,
    r.body,
    r.subject,
    r.meta,
    r.featured,
    r.created_at
  from public.reviews as r
  where r.status = 'approved'
  order by
    r.featured desc,
    r.approved_at desc nulls last,
    r.created_at desc;
$$;

revoke all on function public.get_approved_reviews() from public;
grant execute on function public.get_approved_reviews() to anon, authenticated;
