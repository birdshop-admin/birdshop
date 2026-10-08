import type { Metadata } from "next";

import ComingSoonPage from "@/components/ComingSoonPage";

// Next adds the noindex robots tag to 404 responses itself.
export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <ComingSoonPage
      eyebrow="404 / BirdShop"
      title="Page not found."
      description="The page you were looking for does not exist or may have moved. Head home, browse products, or jump to one of the pages below."
      statusLabel="BirdShop / Page not found"
    />
  );
}
