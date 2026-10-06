import { getServices } from "@/lib/service-catalog";
import { notFound } from "next/navigation";
import ServiceClient from "./ServiceClient";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const services = await getServices();
  if (!services.some((s) => s.slug === slug)) notFound();
  return <ServiceClient slug={slug} serviceList={services} />;
}
