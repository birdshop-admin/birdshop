import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Verified customer reviews of BirdShop products and services.",
};

export default function ReviewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
