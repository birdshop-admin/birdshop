import type { MetadataRoute } from "next";

import { publicOrigin } from "@/lib/public-origin";

// Private pages (orders, chats, checkout, staff area) also send noindex headers
// from next.config.ts; this keeps well-behaved crawlers away from them too.
export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/cart",
          "/checkout",
          "/orders",
          "/service-chat",
          "/services/checkout",
          "/services/*/purchase",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
