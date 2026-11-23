import type { Metadata } from "next";

const title = "Reviews & Vouches | BirdShop";
const description = "Browse BirdShop reviews and vouches together: approved community feedback about products and game services.";
// Versioned separately from the legacy global card so social crawlers fetch anew.
const image = "https://www.birdshop.store/reviews-preview-v1.jpg";

export const metadata: Metadata = {
  title: "Reviews & Vouches",
  description,
  alternates: { canonical: "https://www.birdshop.store/reviews" },
  openGraph: {
    type: "website",
    siteName: "BirdShop",
    locale: "en_US",
    url: "https://www.birdshop.store/reviews",
    title,
    description,
    images: [{ url: image, width: 1200, height: 630, alt: "BirdShop Reviews & Vouches — approved customer feedback" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: image, alt: "BirdShop Reviews & Vouches — approved customer feedback" }],
  },
};

export default function ReviewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
