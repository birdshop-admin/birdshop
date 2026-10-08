import type { Service, ServicePlan, ServiceTierId } from "@/lib/services";

/*
 * Single source of truth for how a service is priced.
 *
 * - A tier is "published" only when checkout would accept it (same rules as
 *   the SQL function birdshop_begin_package_checkout).
 * - A service is "quote-only" when it is customOnly OR has zero published
 *   tiers. Quote-only services show no tiers anywhere, only the Custom quote.
 *
 * Labels are sentence case on purpose: eyebrows are uppercased in CSS, never
 * in markup. Customer-facing copy never says "plan" or "tier".
 */

/* =========================================================
   TYPES
========================================================= */

export type ServicePackageTier = ServiceTierId | "custom";

export type ServicePackageOption = {
  id: string;

  /** True only for a fixed-price tier of an available service. Custom is never "purchasable". */
  purchasable?: boolean;

  tier: ServicePackageTier;

  name: string;

  /** Eyebrow text, sentence case ("Basic package", "Custom quote"). */
  label: string;

  subtitle: string;

  /** Dollars; null for Custom. */
  price: number | null;

  scope: string;

  /** Heading above the includes list, sentence case. */
  directLabel: string;

  directIncludes: string[];

  allIncludes: string[];
};

/** A tier that checkout accepts: enabled with a valid price and scope. */
export type PublishedServicePlan = ServicePlan & {
  enabled: true;
  cents: number;
};

/* =========================================================
   TIERS
========================================================= */

export const SERVICE_TIERS = ["starter", "standard", "premium"] as const satisfies readonly ServiceTierId[];

export const SERVICE_TIER_NAMES: Readonly<Record<ServiceTierId, string>> = {
  starter: "Basic",
  standard: "Standard",
  premium: "Premium",
};

/* Mirrors birdshop_begin_package_checkout (20261008090000). */
const MIN_TIER_CENTS = 50;
const MAX_TIER_CENTS = 99_999_999;
const MIN_SCOPE_LENGTH = 5;

/**
 * True when checkout would accept this tier. Checks the raw shape too, so it
 * is safe on unsanitised admin rows as well as on getServices() output.
 */
export function isPublishedTier(plan: unknown): plan is PublishedServicePlan {
  if (!plan || typeof plan !== "object") return false;

  const p = plan as Record<string, unknown>;

  return (
    (SERVICE_TIERS as readonly unknown[]).includes(p.id) &&
    p.enabled === true &&
    typeof p.cents === "number" &&
    Number.isInteger(p.cents) &&
    p.cents >= MIN_TIER_CENTS &&
    p.cents <= MAX_TIER_CENTS &&
    typeof p.scope === "string" &&
    // Code points, like SQL length(); JS trim() is at least as strict as SQL trim().
    Array.from(p.scope.trim()).length >= MIN_SCOPE_LENGTH &&
    (p.includes === undefined || Array.isArray(p.includes))
  );
}

/**
 * The service's published tiers in Basic → Standard → Premium order.
 * Like checkout, the first enabled entry for each tier id is the one used.
 * Always empty for a customOnly service.
 */
export function publishedTiers(
  service: Pick<Service, "customOnly" | "packages">,
): PublishedServicePlan[] {
  if (service.customOnly) return [];

  const packages: unknown[] = Array.isArray(service.packages)
    ? service.packages
    : [];

  const tiers: PublishedServicePlan[] = [];

  for (const id of SERVICE_TIERS) {
    const plan = packages.find((entry) => {
      const p = entry as Partial<ServicePlan> | null;

      return p != null && p.id === id && p.enabled === true;
    });

    if (isPublishedTier(plan)) tiers.push(plan);
  }

  return tiers;
}

/** Custom quote only: customOnly, or no published tier. */
export function isQuoteOnly(
  service: Pick<Service, "customOnly" | "packages">,
): boolean {
  return publishedTiers(service).length === 0;
}

/* =========================================================
   CUSTOM PACKAGE BUILDER
========================================================= */

const CUSTOM_INCLUDES = [
  "Scope built around your goals",
  "Requirements reviewed before pricing",
  "Written quote before any payment",
  "Turnaround confirmed up front",
  "Private BirdShop service chat",
  "Progress updates as work moves",
  "Completion review with you",
];

function buildCustomPackage(
  service: Service,
  quoteOnly: boolean,
): ServicePackageOption {
  return {
    id: "custom",

    tier: "custom",

    name: quoteOnly ? "Custom quote" : "Custom",

    label: "Custom quote",

    subtitle: quoteOnly
      ? `${service.name} is priced around your exact request. Tell us what you need and we confirm scope, price and timing before you pay.`
      : "Need something outside these packages? We will scope and quote it with you.",

    price: null,

    purchasable: false,

    scope: "Scope and price agreed with you first",

    directLabel: "Every custom quote includes",

    directIncludes: [...CUSTOM_INCLUDES],

    allIncludes: [...CUSTOM_INCLUDES],
  };
}

/* =========================================================
   PACKAGE BUILDER
========================================================= */

/**
 * Quote-only services: only the Custom quote option.
 * Otherwise: the published tiers only (no "coming soon" placeholders), then Custom.
 * A paused service keeps its tiers visible but not purchasable.
 */
export function buildServicePackages(service: Service): ServicePackageOption[] {
  const tiers = publishedTiers(service);

  if (tiers.length === 0) return [buildCustomPackage(service, true)];

  return [
    ...tiers.map((plan): ServicePackageOption => {
      const name = SERVICE_TIER_NAMES[plan.id];
      const scope = plan.scope.trim();
      const includes = Array.isArray(plan.includes) ? plan.includes : [];

      return {
        id: plan.id,
        tier: plan.id,
        name,
        label: `${name} package`,
        subtitle: scope,
        price: plan.cents / 100,
        scope,
        directLabel: "What's included",
        directIncludes: includes,
        allIncludes: includes,
        purchasable: service.available,
      };
    }),
    buildCustomPackage(service, false),
  ];
}

/**
 * First buyable tier; a paused tiered service still opens on its first tier;
 * a quote-only service opens on Custom.
 */
export function getDefaultServicePackageId(packages: ServicePackageOption[]) {
  return (
    packages.find((option) => option.purchasable)?.id ??
    packages.find((option) => option.tier !== "custom")?.id ??
    packages[0]?.id ??
    "custom"
  );
}

/* =========================================================
   LINKS (one place for every storefront CTA)
========================================================= */

/** Contact form preset for a custom quote on this service. */
export function serviceQuoteHref(slug: string) {
  return `/contact?topic=service&service=${encodeURIComponent(slug)}`;
}

/** Secure checkout for one fixed package. */
export function servicePurchaseHref(slug: string, tier: ServiceTierId) {
  return `/services/${encodeURIComponent(slug)}/purchase?package=${tier}`;
}

/** Where a package option's CTA goes: purchase for a tier, contact for Custom. */
export function servicePackageHref(slug: string, option: ServicePackageOption) {
  return option.tier === "custom"
    ? serviceQuoteHref(slug)
    : servicePurchaseHref(slug, option.tier);
}

/** How-to-order deep links (HOW-TO owns the ids). */
export const HOW_TO_ORDER_PACKAGES = "/how-to-order#services";
export const HOW_TO_ORDER_CUSTOM = "/how-to-order#custom";
