-- BirdShop product gallery image storage
-- Run once in Supabase SQL Editor before using Admin > Products image uploads.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public storefronts may read product artwork.
drop policy if exists "BirdShop public can view product images"
on storage.objects;

create policy "BirdShop public can view product images"
on storage.objects
for select
to public
using (
  bucket_id = 'product-images'
);

-- Only approved BirdShop admins may upload new product artwork.
drop policy if exists "BirdShop admins can upload product images"
on storage.objects;

create policy "BirdShop admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_birdshop_admin()
);

-- Included for future replacement / cleanup tools.
drop policy if exists "BirdShop admins can update product images"
on storage.objects;

create policy "BirdShop admins can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_birdshop_admin()
)
with check (
  bucket_id = 'product-images'
  and public.is_birdshop_admin()
);

drop policy if exists "BirdShop admins can delete product images"
on storage.objects;

create policy "BirdShop admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_birdshop_admin()
);
