import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SHARE_IMAGE = "/og-image.jpg";
// Only public product images from this project's storage are used for previews.
const PUBLIC_IMAGE =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/[^\s?#]+$/i;

type ProductMetadataRow = {
  name: string | null;
  short_description: string | null;
  gallery: unknown;
};

function firstGalleryImage(gallery: unknown): string | undefined {
  if (!Array.isArray(gallery)) return undefined;

  for (const item of gallery) {
    const src =
      item && typeof item === "object" && "src" in item
        ? (item as { src?: unknown }).src
        : undefined;

    if (typeof src === "string" && PUBLIC_IMAGE.test(src.trim())) {
      return src.trim();
    }
  }

  return undefined;
}

type ProductLookup =
  | { status: "found"; row: ProductMetadataRow }
  | { status: "missing" }
  | { status: "unknown" };

// One lookup per request, shared by metadata and the layout. "unknown" (missing
// env, timeout, network) never produces a 404: the client page then loads normally.
const lookupProduct = cache(async (slug: string): Promise<ProductLookup> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return { status: "unknown" };

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("products")
      .select("name,short_description,gallery")
      .eq("slug", slug)
      .eq("is_visible", true)
      .abortSignal(AbortSignal.timeout(1500))
      .maybeSingle<ProductMetadataRow>();

    if (error) return { status: "unknown" };

    return data && data.name ? { status: "found", row: data } : { status: "missing" };
  } catch {
    return { status: "unknown" };
  }
});

// Per-product tab titles and share cards. Any failure falls back to the parent
// "Products" metadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await lookupProduct(slug);

  if (product.status === "unknown") return {};

  if (product.status === "missing") {
    return {
      title: "Product not found",
      robots: { index: false },
    };
  }

  const data = product.row;

  const title = data.name ?? "Product";
  const description = data.short_description?.trim() || undefined;
  // A page-level openGraph replaces the layout's whole object, so keep the
  // default share image as the fallback.
  const image = firstGalleryImage(data.gallery) ?? DEFAULT_SHARE_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: `/products/${encodeURIComponent(slug)}` },
    openGraph: {
      type: "website",
      siteName: "BirdShop",
      locale: "en_US",
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

// A product that definitely does not exist (or is hidden) returns a real 404.
export default async function ProductLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ slug: string }> }>) {
  const { slug } = await params;

  if ((await lookupProduct(slug)).status === "missing") notFound();

  return children;
}
