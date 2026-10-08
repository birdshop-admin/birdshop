import type { Metadata } from "next";

import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  // A plain string title here would stop the root "%s | BirdShop" template
  // from reaching /products/[slug] (Next passes on only the template of the
  // closest layout), so the template is declared again for product pages.
  title: {
    default: "Products",
    template: `%s | ${siteConfig.name}`,
  },
  description: "Digital product keys from BirdShop, delivered privately after verified payment.",
};

export default function ProductsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
