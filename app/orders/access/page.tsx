import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { OrderAccess } from "@/components/PrivateOrder";
export const metadata = {
  title: "Private order · BirdShop",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="page-shell">
      <SiteHeader />
      <Suspense fallback={<p>Opening your order…</p>}>
        <OrderAccess />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
