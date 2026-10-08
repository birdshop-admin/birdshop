import type { Metadata } from "next";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  // An object (not a plain string), so the "%s | BirdShop" template keeps
  // applying to the service detail and purchase titles below this layout.
  title: {
    default: "Services",
    template: `%s | ${siteConfig.name}`,
  },
  description:
    "Game services from BirdShop, with fixed packages or custom requests.",
};

export default function ServicesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
