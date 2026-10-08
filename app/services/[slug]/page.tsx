import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getService, getServices } from "@/lib/service-catalog";

import ServiceClient from "./ServiceClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/* Default share card from the root layout (public/og-image.jpg). */
const DEFAULT_SHARE_IMAGE = "/og-image.jpg";

/*
 * Tab title and share card per service. getService/getServices are wrapped in
 * React cache, so this and the page share one catalog query per request.
 * A page-level openGraph replaces the layout's whole object, so it repeats
 * type/siteName/locale and always carries an image.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);

  if (!service) {
    return {
      title: "Service not found",
      robots: { index: false },
    };
  }

  const title = service.name;
  const description = service.shortDescription || undefined;
  const image = service.image ?? DEFAULT_SHARE_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: `/services/${encodeURIComponent(service.slug)}` },
    openGraph: {
      type: "website",
      siteName: "BirdShop",
      locale: "en_US",
      title: `${title} | BirdShop`,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | BirdShop`,
      description,
      images: [image],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const services = await getServices();

  if (!services.some((s) => s.slug === slug)) notFound();

  return <ServiceClient slug={slug} serviceList={services} />;
}
