export type ReviewType =
  | "Product"
  | "Service";

export type Review = {
  id: string;
  type: ReviewType;
  reviewer: string;
  initials: string;
  rating: number;
  title: string;
  body: string;
  subject: string;
  meta: string;
  featured?: boolean;
  date: string;
};

/*
 * Kept as an empty export for compatibility with any older
 * BirdShop code that may still import `reviews`.
 *
 * Public reviews now come exclusively from approved Supabase
 * submissions. No sample / filler reviews are shipped here.
 */
export const reviews: Review[] = [];

export const reviewTypes = [
  "All Reviews",
  "Products",
  "Services",
] as const;

export type ReviewFilter =
  (typeof reviewTypes)[number];
