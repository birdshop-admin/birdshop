import type { Metadata } from "next";
import { Suspense } from "react";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

import s from "../[slug]/purchase/purchase.module.css";
import ServiceCheckout from "./ServiceCheckout";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false },
};

/* Branded placeholder while the status reader (useSearchParams) hydrates. */
function CheckingStatus() {
  return (
    <section className={s.layout}>
      <div className={s.summary}>
        <span className={s.eyebrow}>Service purchase</span>
        <h1>Your next step starts here</h1>
      </div>

      <div className={s.card} aria-busy="true">
        <span className={s.eyebrow}>Payment status</span>
        <h2>Checking your checkout…</h2>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="page-shell">
      <SiteHeader />

      <Suspense fallback={<CheckingStatus />}>
        <ServiceCheckout />
      </Suspense>

      <SiteFooter />
    </main>
  );
}
