import type { MetadataRoute } from "next";

import { publicOrigin } from "@/lib/public-origin";
import { getServices } from "@/lib/service-catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 3600;

const STATIC_PATHS = [
  "/",
  "/products",
  "/services",
  "/how-to-order",
  "/reviews",
  "/faqs",
  "/contact",
  "/terms",
  "/privacy",
  "/refunds",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
  }));

  // Catalog pages are a bonus: if the database is unreachable the sitemap
  // still lists every static page instead of failing.
  try {
    const [services, { data: products }] = await Promise.all([
      getServices(),
      createAdminClient()
        .from("products")
        .select("slug")
        .eq("is_visible", true)
        .limit(500),
    ]);

    for (const product of products ?? []) {
      if (typeof product.slug === "string" && product.slug)
        entries.push({
          url: `${origin}/products/${encodeURIComponent(product.slug)}`,
        });
    }

    for (const service of services) {
      entries.push({
        url: `${origin}/services/${encodeURIComponent(service.slug)}`,
      });
    }
  } catch {
    console.error("BirdShop sitemap could not load catalog pages");
  }

  return entries;
}
