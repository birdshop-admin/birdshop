import { preload } from "react-dom";

import {
  mapDatabaseProduct,
  PRODUCT_COLUMNS,
  type DatabaseProduct,
} from "@/lib/product-catalog";
import type { Product } from "@/lib/products";
import { getServices } from "@/lib/service-catalog";
import { isQuoteOnly } from "@/lib/service-packages";
import type { Service } from "@/lib/services";
import { createClient } from "@/lib/supabase/server";

import HomeClient, { type HomeService } from "./HomeClient";

export const dynamic = "force-dynamic";

const FEATURED_LIMIT = 3;

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return String(error);
}

/*
 * Same query and mapper as the cart catalog (app/cart-context.tsx), with the
 * publishable key, so the server copy matches what the browser loads next and
 * the cards do not reorder after hydration. null means "could not load".
 */
async function loadProducts(): Promise<Product[] | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    return ((data ?? []) as unknown as DatabaseProduct[]).map(
      mapDatabaseProduct,
    );
  } catch (error) {
    console.error("[home] products could not be loaded:", errorMessage(error));
    return null;
  }
}

/* A services outage shows a message in its row instead of failing the page. */
async function loadServices(): Promise<Service[] | null> {
  try {
    return await getServices();
  } catch (error) {
    console.error("[home] services could not be loaded:", errorMessage(error));
    return null;
  }
}

/* In-stock first, then sold-out items fill any empty slots. HomeClient applies
   the same rule to the live catalog. */
function pickFeaturedProducts(list: Product[]) {
  return [
    ...list.filter((product) => product.stock > 0),
    ...list.filter((product) => product.stock <= 0),
  ].slice(0, FEATURED_LIMIT);
}

/* Only what a home card renders reaches the browser. */
function toHomeService(service: Service): HomeService {
  return {
    slug: service.slug,
    name: service.name,
    game: service.game,
    category: service.category,
    initials: service.initials,
    shortDescription: service.shortDescription,
    startingPrice: service.startingPrice,
    badge: service.badge,
    quoteOnly: isQuoteOnly(service),
    available: service.available,
    // Already sanitised by getServices (null unless this project's storage URL).
    image: service.image ?? null,
  };
}

export default async function Page() {
  // The hero photo is a CSS background, so the browser would find it late.
  preload("/landscape1.webp", {
    as: "image",
    fetchPriority: "high",
    type: "image/webp",
  });

  const [products, services] = await Promise.all([
    loadProducts(),
    loadServices(),
  ]);

  // getServices is React-cached for the request: filter into new arrays only.
  const available = services?.filter((service) => service.available) ?? [];

  const featuredServices = [
    ...available.filter((service) => service.featured),
    ...available.filter((service) => !service.featured),
  ]
    .slice(0, FEATURED_LIMIT)
    .map(toHomeService);

  return (
    <HomeClient
      initialProducts={products ? pickFeaturedProducts(products) : null}
      productTotal={products?.length ?? 0}
      services={services ? featuredServices : null}
      serviceTotal={available.length}
    />
  );
}
