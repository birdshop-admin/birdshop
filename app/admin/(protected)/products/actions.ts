"use server";
import { requireOwner } from "@/lib/staff-auth";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { productList } from "@/lib/products";

/* =========================================================
   HELPERS
========================================================= */

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalValue(formData: FormData, name: string) {
  const result = value(formData, name);

  return result.length > 0 ? result : null;
}

function numberValue(formData: FormData, name: string) {
  const raw = value(formData, name);

  const parsed = Number(raw);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

function integerValue(formData: FormData, name: string) {
  return Math.max(0, Math.floor(numberValue(formData, name)));
}

function visibleValue(formData: FormData) {
  return formData.getAll("is_visible").some((item) => String(item) === "true");
}

function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

const PRODUCT_IMAGE_BUCKET = "product-images";

const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const PRODUCT_IMAGE_TYPES = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function galleryValue(
  formData: FormData,
  index: number,
  field: "display" | "label" | "src",
) {
  return value(formData, `gallery_${index}_${field}`);
}

function galleryRemoveValue(formData: FormData, index: number) {
  return String(formData.get(`gallery_${index}_remove`) ?? "") === "true";
}

function galleryFileValue(formData: FormData, index: number) {
  const entry = formData.get(`gallery_${index}_file`);

  if (!(entry instanceof File) || entry.size <= 0) {
    return null;
  }

  return entry;
}

async function uploadGalleryImage(
  supabase: SupabaseServerClient,
  file: File,
  slug: string,
  index: number,
) {
  const extension = PRODUCT_IMAGE_TYPES.get(file.type);

  if (!extension) {
    throw new Error("Product artwork must be a PNG, JPG, or WEBP image.");
  }

  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error("Product artwork must be 8 MB or smaller.");
  }

  const safeSlug = normalizeSlug(slug) || "product";

  const path = `${safeSlug}/tile-${index}-${crypto.randomUUID()}.${extension}`;

  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,

      cacheControl: "31536000",

      upsert: false,
    });

  if (error) {
    throw new Error(
      `Unable to upload product artwork: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  const { data } = supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(path);

  return {
    path,

    publicUrl: data.publicUrl,
  };
}

/* =========================================================
   EXISTING GALLERY IMAGE

   This is important because browser file inputs always
   reset after refresh / logout / navigation.

   Instead of relying only on the form, BirdShop reads the
   image currently stored inside the product's gallery data.
========================================================= */

function existingGallerySrc(gallery: unknown, index: number) {
  if (!Array.isArray(gallery)) {
    return "";
  }

  const item = gallery[index - 1];

  if (!item || typeof item !== "object") {
    return "";
  }

  const src = (item as Record<string, unknown>).src;

  return typeof src === "string" ? src.trim() : "";
}

/* =========================================================
   BUILD GALLERY
========================================================= */

async function buildGallery(
  formData: FormData,
  fallbackInitials: string,
  supabase: SupabaseServerClient,
  slug: string,
  existingGallery?: unknown,
) {
  const previousInitials = value(formData, "previous_initials");

  const gallery: Array<{
    id: string;
    label: string;
    display: string;
    src?: string;
  }> = [];

  const uploadedPaths: string[] = [];

  for (let offset = 0; offset < 4; offset += 1) {
    const index = offset + 1;

    const defaultDisplays = [fallbackInitials, "INFO", "PLATFORM", "CODE"];

    const defaultLabels = ["Main", "Details", "Platform", "Code"];

    const submittedDisplay = galleryValue(formData, index, "display");

    const display =
      index === 1 &&
      (!submittedDisplay ||
        (previousInitials && submittedDisplay === previousInitials))
        ? fallbackInitials
        : submittedDisplay || defaultDisplays[offset];

    const label =
      galleryValue(formData, index, "label") || defaultLabels[offset];

    const submittedSrc = galleryValue(formData, index, "src");

    /*
     * If the form contains the saved URL, use it.
     *
     * If it does not, BirdShop falls back to the gallery
     * currently stored in Supabase.
     *
     * This prevents a refresh or cleared file picker from
     * removing already-uploaded artwork.
     */
    const existingSrc =
      submittedSrc || existingGallerySrc(existingGallery, index);

    const removeImage = galleryRemoveValue(formData, index);

    const imageFile = galleryFileValue(formData, index);

    let src = removeImage ? "" : existingSrc;

    /*
     * A newly selected file replaces the previous image.
     */
    if (imageFile) {
      const uploaded = await uploadGalleryImage(
        supabase,
        imageFile,
        slug,
        index,
      );

      uploadedPaths.push(uploaded.path);

      src = uploaded.publicUrl;
    }

    gallery.push({
      id: index === 1 ? "main" : `tile-${index}`,

      label,

      display: display || fallbackInitials || "BS",

      ...(src
        ? {
            src,
          }
        : {}),
    });
  }

  return {
    gallery,
    uploadedPaths,
  };
}

/* =========================================================
   CLEAN UP FAILED UPLOADS
========================================================= */

async function cleanupUploadedImages(
  supabase: SupabaseServerClient,
  paths: string[],
) {
  if (paths.length === 0) {
    return;
  }

  await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
}

/* =========================================================
   AUTHORIZATION
========================================================= */

async function requireAdmin() {
  return (await requireOwner()).supabase;
}

/* =========================================================
   REVALIDATE PRODUCT PAGES
========================================================= */

function refreshProducts(...slugs: Array<string | null | undefined>) {
  revalidatePath("/admin/products");

  revalidatePath("/products");

  for (const slug of slugs) {
    if (slug) {
      revalidatePath(`/products/${slug}`);
    }
  }

  revalidatePath("/");
}

/* =========================================================
   IMPORT CURRENT LOCAL CATALOG
========================================================= */

export async function syncLocalProducts() {
  const supabase = await requireAdmin();

  const rows = productList.map((product, index) => ({
    slug: product.slug,

    name: product.name,

    category: product.category,

    platform: product.platform,

    region: product.region,

    price: product.price,

    old_price: product.oldPrice ?? null,

    badge: product.badge ?? null,

    stock: product.stock,

    delivery: product.delivery,

    description: product.description,

    short_description: product.shortDescription,

    code_format: product.codeFormat,

    initials: product.initials,

    gallery: product.gallery,

    is_visible: true,

    sort_order: index,
  }));

  const { error } = await supabase.from("products").upsert(rows, {
    onConflict: "slug",
  });

  if (error) {
    throw new Error(
      `Unable to import products: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  refreshProducts();
}

/* =========================================================
   CREATE PRODUCT
========================================================= */

export async function createProduct(formData: FormData) {
  const supabase = await requireAdmin();

  const name = value(formData, "name");

  const requestedSlug = value(formData, "slug");

  const slug = normalizeSlug(requestedSlug || name);

  if (!name || !slug) {
    throw new Error("A product name and slug are required.");
  }

  const initialsInput = value(formData, "initials");

  const initials = initialsInput || generateInitials(name);

  const { gallery, uploadedPaths } = await buildGallery(
    formData,
    initials,
    supabase,
    slug,
  );

  const { error } = await supabase.from("products").insert({
    slug,

    name,

    category: value(formData, "category"),

    platform: value(formData, "platform"),

    region: value(formData, "region"),

    price: numberValue(formData, "price"),

    old_price: optionalValue(formData, "old_price")
      ? numberValue(formData, "old_price")
      : null,

    badge: optionalValue(formData, "badge"),

    stock: integerValue(formData, "stock"),

    delivery: value(formData, "delivery"),

    description: value(formData, "description"),

    short_description: value(formData, "short_description"),

    code_format: value(formData, "code_format"),

    initials,

    gallery,

    is_visible: visibleValue(formData),

    sort_order: integerValue(formData, "sort_order"),
  });

  if (error) {
    await cleanupUploadedImages(supabase, uploadedPaths);

    throw new Error(
      `Unable to create product: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  refreshProducts(slug);
}

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export async function updateProduct(formData: FormData) {
  const supabase = await requireAdmin();

  const id = value(formData, "id");

  const name = value(formData, "name");

  const slug = normalizeSlug(value(formData, "slug"));

  if (!id || !name || !slug) {
    throw new Error("Product ID, name, and slug are required.");
  }

  const initialsInput = value(formData, "initials");

  const initials = initialsInput || generateInitials(name);

  /*
   * Read the current product directly from Supabase BEFORE
   * rebuilding the gallery.
   *
   * This is the persistence fix.
   */
  const {
    data: currentProduct,

    error: currentProductError,
  } = await supabase
    .from("products")
    .select("slug, gallery")
    .eq("id", id)
    .maybeSingle();

  if (currentProductError || !currentProduct) {
    throw new Error(
      `Unable to load the current product before saving: ${"Product could not be loaded. Refresh and retry."}`,
    );
  }

  const previousSlug =
    typeof currentProduct.slug === "string" ? currentProduct.slug : "";

  const { gallery, uploadedPaths } = await buildGallery(
    formData,
    initials,
    supabase,
    slug,
    currentProduct.gallery,
  );

  const { error } = await supabase
    .from("products")
    .update({
      slug,

      name,

      category: value(formData, "category"),

      platform: value(formData, "platform"),

      region: value(formData, "region"),

      price: numberValue(formData, "price"),

      old_price: optionalValue(formData, "old_price")
        ? numberValue(formData, "old_price")
        : null,

      badge: optionalValue(formData, "badge"),

      stock: integerValue(formData, "stock"),

      delivery: value(formData, "delivery"),

      description: value(formData, "description"),

      short_description: value(formData, "short_description"),

      code_format: value(formData, "code_format"),

      initials,

      gallery,

      is_visible: visibleValue(formData),

      sort_order: integerValue(formData, "sort_order"),
    })
    .eq("id", id);

  if (error) {
    await cleanupUploadedImages(supabase, uploadedPaths);

    throw new Error(
      `Unable to update product: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  /*
   * Revalidate both the old and current slug.
   *
   * This prevents the public product page from continuing
   * to display an older cached gallery.
   */
  refreshProducts(previousSlug, slug);
}

/* =========================================================
   DELETE PRODUCT
========================================================= */

export async function deleteProduct(id: string) {
  const supabase = await requireAdmin();

  const { data: product } = await supabase
    .from("products")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    throw new Error(
      `Unable to delete product: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  refreshProducts(product?.slug ?? null);
}
