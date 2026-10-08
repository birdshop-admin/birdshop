// Shared mapping for rows of the public `products` table.
// Plain module: safe to import from client components (cart-context) and from
// server components (app/page.tsx) alike.

import type { Product } from "@/lib/products";

/** Columns every storefront catalog query selects. `description` is needed by product detail. */
export const PRODUCT_COLUMNS: string = [
  "id",
  "slug",
  "name",
  "category",
  "platform",
  "region",
  "price",
  "old_price",
  "badge",
  "stock",
  "delivery",
  "description",
  "short_description",
  "code_format",
  "initials",
  "gallery",
  "is_visible",
  "sort_order",
  "inventory_mode",
].join(",");

export type DatabaseProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  platform: string;
  region: string;
  price: number | string;
  old_price: number | string | null;
  badge: string | null;
  stock: number;
  delivery: string;
  description: string;
  short_description: string;
  code_format: string;
  initials: string;
  gallery: unknown;
  is_visible: boolean;
  sort_order: number;
  inventory_mode: string | null;
};

export function normalizeGallery(row: DatabaseProduct): Product["gallery"] {
  if (Array.isArray(row.gallery) && row.gallery.length > 0) {
    return row.gallery as Product["gallery"];
  }

  const display =
    (row.initials ?? "").trim() ||
    (row.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") ||
    "BS";

  return [
    {
      id: "primary",
      label: "Product",
      display,
    },
  ] as Product["gallery"];
}

export function mapDatabaseProduct(row: DatabaseProduct): Product {
  const price = Number(row.price);
  const oldPrice = row.old_price === null ? undefined : Number(row.old_price);

  return {
    slug: row.slug,
    name: row.name,
    category: row.category,
    platform: row.platform,
    region: row.region,
    price: Number.isFinite(price) ? price : 0,
    oldPrice:
      oldPrice !== undefined && Number.isFinite(oldPrice)
        ? oldPrice
        : undefined,
    badge: row.badge ?? undefined,
    // Checkout only sells key-managed codes; manual-mode stock cannot be purchased online.
    stock:
      row.inventory_mode === "keys"
        ? Math.max(0, Math.floor(Number(row.stock) || 0))
        : 0,
    delivery: row.delivery,
    description: row.description,
    shortDescription: row.short_description,
    codeFormat: row.code_format,
    initials: row.initials || (row.name ?? "").slice(0, 2).toUpperCase(),
    gallery: normalizeGallery(row),
  };
}
