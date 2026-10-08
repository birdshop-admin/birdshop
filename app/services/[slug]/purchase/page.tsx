import { getService } from "@/lib/service-catalog";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Purchase from "./Purchase";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ package?: string }>;
}) {
  const { slug } = await params,
    { package: tier } = await searchParams;
  const service = await getService(slug);
  const plan = service?.packages?.find(
    (p) => p.id === tier && p.enabled && p.cents !== null,
  );
  if (!service || !service.available || service.customOnly || !plan) notFound();
  return (
    <main className="page-shell">
      <SiteHeader />
      <Purchase service={service} plan={plan} />
      <SiteFooter />
    </main>
  );
}
