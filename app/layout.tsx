import type { Metadata, Viewport } from "next";

import "./globals.css";
import "./theme.css";
import ThemeToggle from "@/components/ThemeToggle";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t='light';try{var s=localStorage.getItem('birdshop-theme');t=s==='dark'||s==='light'?s:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){}document.documentElement.dataset.theme=t})();` }} />
        <link
          rel="preload"
          as="image"
          href="/landscape1.png"
        />
      </head>

      <body>
        <SiteAnalyticsTracker />
        <ThemeToggle />

        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
