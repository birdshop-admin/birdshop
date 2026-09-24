import type { Metadata, Viewport } from "next";

import "./globals.css";
import "../components/site-header.css";

import { CartProvider } from "./cart-context";
import SiteAnalyticsTracker from "@/components/SiteAnalyticsTracker";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  themeColor: "#0b120d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          as="image"
          href="/landscape1.png"
        />
      </head>

      <body>
        <SiteAnalyticsTracker />

        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
