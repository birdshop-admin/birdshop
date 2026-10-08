import type { Metadata } from "next";
import { notFound } from "next/navigation";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getService } from "@/lib/service-catalog";
import { isQuoteOnly, publishedTiers } from "@/lib/service-packages";
import type { Service } from "@/lib/services";

import Purchase from "./Purchase";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ package?: string | string[] }>;
};

/*
 * The fixed package a customer may buy here, or undefined. Quote-only
 * (custom only, or no published package), paused, unknown, unpublished and
 * tampered ?package= values all resolve to undefined → 404. Checkout still
 * re-checks availability and price on the server.
 */
function purchasablePlan(service: Service | undefined, requested: unknown) {
  if (!service || !service.available || isQuoteOnly(service)) return undefined;

  const tier = typeof requested === "string" ? requested : "";

  return publishedTiers(service).find((plan) => plan.id === tier);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);

  return {
    title: service ? `Buy ${service.name}` : "Service not found",
    robots: { index: false },
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ slug }, { package: requested }] = await Promise.all([
    params,
    searchParams,
  ]);

  const service = await getService(slug);
  const plan = purchasablePlan(service, requested);

  if (!service || !plan) notFound();

  return (
    <main className="page-shell">
      <SiteHeader />
      <Purchase service={service} plan={plan} />
      <SiteFooter />
    </main>
  );
}
