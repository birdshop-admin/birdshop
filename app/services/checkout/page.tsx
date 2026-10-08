import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ServiceCheckout from "./ServiceCheckout";
export default function Page() {
  return <main className="page-shell"><SiteHeader />
    <Suspense fallback={<p>Loading your payment status…</p>}><ServiceCheckout /></Suspense>
    <SiteFooter /></main>;
}
