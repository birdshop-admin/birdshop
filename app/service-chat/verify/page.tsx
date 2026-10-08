import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import InboxVerify from "./InboxVerify";
export const metadata: Metadata = {
  title: "Open your inbox",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";
export default function InboxVerifyPage() {
  return (
    <main className="page-shell">
      <SiteHeader />
      <InboxVerify />
      <SiteFooter />
    </main>
  );
}
