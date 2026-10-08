import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your BirdShop cart and check out securely.",
};

export default function CartLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
