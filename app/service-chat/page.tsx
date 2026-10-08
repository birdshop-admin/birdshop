import type {
  Metadata,
} from "next";

import {
  Suspense,
} from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import ServiceChatClient from "./ServiceChatClient";

export const metadata: Metadata = {
  title:
    "My Service",

  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic =
  "force-dynamic";

export default function ServiceChatPage() {
  return (
    <main className="page-shell">
      <SiteHeader />

      <Suspense>
        <ServiceChatClient />
      </Suspense>

      <SiteFooter />
    </main>
  );
}