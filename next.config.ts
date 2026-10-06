import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      ...[
        "/service-chat/:path*",
        "/api/customer-inbox/:path*",
        "/api/customer-device/:path*",
        "/checkout/:path*",
        "/orders/:path*",
        "/admin/:path*",
        "/api/service-chat/:path*",
        "/api/orders/:path*",
        "/api/checkout/:path*",
        "/api/services/purchase",
        "/services/:slug/purchase",
      ].map((source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      })),
    ];
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "40mb",
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
