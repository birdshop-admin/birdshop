import type { Metadata, Viewport } from "next";

import "./globals.css";
import "./theme.css";
import ThemeToggle from "@/components/ThemeToggle";
import "../components/site-header.css";

import { CartProvider } from "./cart-context";
import SiteAnalyticsTracker from "@/components/SiteAnalyticsTracker";
import { siteConfig } from "@/lib/site-config";
import { ADMIN_FIT_HEAD_SCRIPT } from "@/lib/admin-fit";

// Absolute base for share images and canonical URLs. lib/server-config's
// siteUrl() throws when the variable is missing, so it is not used here: an
// invalid or missing value simply leaves metadataBase unset.
function siteOrigin(): URL | undefined {
  const value = process.env.BIRDSHOP_SITE_URL?.trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    return url.protocol === "https:" || (url.protocol === "http:" && local)
      ? new URL(url.origin)
      : undefined;
  } catch {
    return undefined;
  }
}

const metadataBase = siteOrigin();

const shareImage = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "BirdShop — digital products and game services",
};

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Title and description are left out so each page's own values flow into
  // the share card. A page that sets openGraph replaces this whole object and
  // must keep images: ["/og-image.jpg"] as its fallback.
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "en_US",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [shareImage.url],
  },
  // public/favicon.ico (16/32/48) also answers browsers' automatic
  // /favicon.ico request; the PNGs serve higher densities.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b120d",
  // Keep chat composers and forms above the Android on-screen keyboard.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-scroll-behavior lets Next jump instantly to the top on route
    // changes while in-page anchors keep the CSS smooth scrolling.
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Staff admin fit-to-screen scale, before first paint (lib/admin-fit.ts). */}
        <script dangerouslySetInnerHTML={{ __html: ADMIN_FIT_HEAD_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var d=document.documentElement,t='light';try{var a=location.pathname.indexOf('/admin')===0,s=localStorage.getItem(a?'birdshop-admin-theme':'birdshop-theme');if(a&&s===null){s=localStorage.getItem('birdshop-theme')||'light';localStorage.setItem('birdshop-admin-theme',s)}if(s==='dark')t='dark';if(!s&&!a){var n=Number(localStorage.getItem('birdshop-theme-hint')||0);if(n<3){d.dataset.themeHint='1';localStorage.setItem('birdshop-theme-hint',String(n+1))}}}catch(e){}d.dataset.theme=t})();` }} />
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
