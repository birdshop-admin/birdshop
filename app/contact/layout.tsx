import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Start a private conversation with BirdShop support.",
};

export default function ContactLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
