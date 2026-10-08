import type { Service } from "@/lib/services";

/* =========================================================
   TYPES
========================================================= */

export type ServicePackageTier = "starter" | "standard" | "premium" | "custom";

export type InheritedPackageGroup = {
  tier: ServicePackageTier;

  name: string;

  items: string[];
};

export type ServicePackageOption = {
  id: string;

  purchasable?: boolean;

  tier: ServicePackageTier;

  name: string;

  label: string;

  subtitle: string;

  price: number | null;

  recommended?: boolean;

  scope: string;

  directLabel: string;

  directIncludes: string[];

  allIncludes: string[];

  inheritsLabel?: string;

  inheritanceSummary?: string;

  inheritedGroups?: InheritedPackageGroup[];
};

/* =========================================================
   HELPERS
========================================================= */

function uniqueItems(items: Array<string | undefined>) {
  return Array.from(
    new Set(items.filter((item): item is string => Boolean(item))),
  );
}

/* =========================================================
   CUSTOM PACKAGE BUILDER
========================================================= */

function buildCustomPackage(
  service: Service,
  recommended = false,
): ServicePackageOption {
  const customIncludes = uniqueItems([
    "Choose a completely custom scope",

    "Scope tailored to your goals",

    "Requirements reviewed before pricing",

    "Quote confirmed before work begins",

    "Turnaround confirmed before starting",

    "Private BirdShop service chat",

    "Progress updates when applicable",

    "Completion review",
  ]);

  return {
    id: "custom",

    tier: "custom",

    name: "Custom",

    label: "CUSTOM REQUEST",

    subtitle: `Build a personalized ${service.name} request around exactly what you need.`,

    price: null,

    recommended,

    scope: "Custom scope confirmed with you",

    directLabel: "CUSTOM REQUEST INCLUDES",

    directIncludes: customIncludes,

    allIncludes: customIncludes,
  };
}

/* =========================================================
   PACKAGE BUILDER
========================================================= */

export function buildServicePackages(service: Service): ServicePackageOption[] {
  if (service.customOnly) return [buildCustomPackage(service)];
  const tiers = ["starter", "standard", "premium"] as const;
  return [
    ...tiers.map((id, index) => {
      const p = service.packages?.find((plan) => plan.id === id);
      const ready = !!(service.available && p?.enabled && p.cents !== null);
      const name = ["Basic", "Standard", "Premium"][index];
      return {
        id, tier: id, name, label: name.toUpperCase() + " PACKAGE",
        subtitle: ready ? p!.scope : "This package is not currently available to purchase.",
        price: ready ? p!.cents! / 100 : null,
        scope: ready ? p!.scope : "Package details coming soon",
        directLabel: "WHAT IS INCLUDED",
        directIncludes: ready ? p!.includes : [],
        allIncludes: ready ? p!.includes : [],
        purchasable: ready,
      };
    }),
    buildCustomPackage(service),
  ];
}

export function getDefaultServicePackageId(packages: ServicePackageOption[]) {
  return packages.find((option) => option.purchasable)?.id ?? packages[0]?.id ?? "custom";
}
