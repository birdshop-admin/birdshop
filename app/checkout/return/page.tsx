import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CheckoutReturn } from "@/components/PrivateOrder";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="page-shell">
      <SiteHeader />
      <Suspense fallback={<p>Checking your order…</p>}>
        <CheckoutReturn />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
