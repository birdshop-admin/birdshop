export type ServicePlan = {
  id: "starter" | "standard" | "premium";
  name: string;
  enabled: boolean;
  cents: number | null;
  scope: string;
  includes: string[];
};
export type Service = {
  customOnly?: boolean;
  packages?: ServicePlan[];
  slug: string;
  name: string;
  game: string;
  category: string;
  initials: string;

  shortDescription: string;
  description: string;

  startingPrice: number | null;

  turnaround: string;
  delivery: string;

  badge?: string;
  featured?: boolean;

  available: boolean;

  features: string[];
};
