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
  return [
    ...(service.packages ?? [])
      .filter((p) => p.enabled && p.cents !== null)
      .map((p) => ({
        id: p.id,
        tier: p.id,
        name: p.name,
        label: p.name.toUpperCase() + " PACKAGE",
        subtitle: p.scope,
        price: p.cents! / 100,
        scope: p.scope,
        directLabel: "WHAT IS INCLUDED",
        directIncludes: p.includes,
        allIncludes: p.includes,
        recommended: p.id === "standard",
      })),
    buildCustomPackage(service),
  ];
}

export function getDefaultServicePackageId(_packages: ServicePackageOption[]) {
  return _packages.find((option) => option.id !== "custom")?.id ?? "custom";
}
