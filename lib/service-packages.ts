import type {
  Service,
} from "@/lib/services";

/* =========================================================
   TYPES
========================================================= */

export type ServicePackageTier =
  | "starter"
  | "standard"
  | "premium"
  | "custom";

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

function money(
  value: number
) {
  return (
    Math.round(
      value * 100
    ) / 100
  );
}

function uniqueItems(
  items: Array<
    string | undefined
  >
) {
  return Array.from(
    new Set(
      items.filter(
        (
          item
        ): item is string =>
          Boolean(
            item
          )
      )
    )
  );
}

function removeInherited(
  items: string[],
  inherited: string[]
) {
  return uniqueItems(
    items
  ).filter(
    (
      item
    ) =>
      !inherited.includes(
        item
      )
  );
}

/* =========================================================
   CUSTOM PACKAGE BUILDER
========================================================= */

function buildCustomPackage(
  service: Service,
  recommended = false
): ServicePackageOption {
  const customIncludes =
    uniqueItems([
      "Choose a completely custom scope",

      "Customize an existing package",

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

    name:
      "Custom",

    label:
      "CUSTOM REQUEST",

    subtitle:
      `Build a personalized ${service.name} request around exactly what you need.`,

    price: null,

    recommended,

    scope:
      "Custom scope confirmed with you",

    directLabel:
      "CUSTOM REQUEST INCLUDES",

    directIncludes:
      customIncludes,

    allIncludes:
      customIncludes,
  };
}

/* =========================================================
   PACKAGE BUILDER
========================================================= */

export function buildServicePackages(
  service: Service
): ServicePackageOption[] {
  /* =======================================================
     CUSTOM-ONLY SERVICE
  ======================================================= */

  if (
    service.startingPrice ===
    null
  ) {
    return [
      buildCustomPackage(
        service,
        true
      ),
    ];
  }

  const base =
    service.startingPrice;

  /* =======================================================
     BASIC

     NOTE:
     Internal ID remains "starter".
     Customers only see "Basic".
  ======================================================= */

  const basicIncludes =
    uniqueItems([
      service.features[0],

      service.features[1],

      "Focused service scope",

      "Requirements confirmed before starting",

      "Private BirdShop service chat",

      "Standard turnaround",

      "Completion confirmation",
    ]);

  /* =======================================================
     STANDARD UPGRADES
  ======================================================= */

  const standardCandidates =
    uniqueItems([
      service.features[2],

      service.features[3],

      "Expanded request scope",

      "Priority communication",

      "Detailed progress updates",

      "Additional flexibility during service",

      "More room for additional objectives",

      "Completion review",
    ]);

  const standardUpgrades =
    removeInherited(
      standardCandidates,
      basicIncludes
    );

  const standardAll =
    uniqueItems([
      ...basicIncludes,
      ...standardUpgrades,
    ]);

  /* =======================================================
     PREMIUM UPGRADES
  ======================================================= */

  const premiumCandidates =
    uniqueItems([
      "Largest available service scope",

      "Priority handling",

      "Highest communication priority",

      "Detailed progress tracking",

      "Expanded request flexibility",

      "Additional objective support",

      "Requirements planning",

      "Priority completion review",

      "Post-service support",
    ]);

  const premiumUpgrades =
    removeInherited(
      premiumCandidates,
      standardAll
    );

  const premiumAll =
    uniqueItems([
      ...standardAll,
      ...premiumUpgrades,
    ]);

  /* =======================================================
     PACKAGE LIST

     Priced services always expose:
     Basic -> Standard -> Premium -> Custom
  ======================================================= */

  return [
    /* =====================================================
       BASIC
    ===================================================== */

    {
      id: "starter",

      tier: "starter",

      name: "Basic",

      label:
        "BASIC PACKAGE",

      subtitle:
        `A focused ${service.name} option for a smaller, clearly defined request.`,

      price: base,

      scope:
        "Focused service scope",

      directLabel:
        "BASIC INCLUDES",

      directIncludes:
        basicIncludes,

      allIncludes:
        basicIncludes,
    },

    /* =====================================================
       STANDARD
    ===================================================== */

    {
      id: "standard",

      tier: "standard",

      name: "Standard",

      label:
        "MOST POPULAR",

      subtitle:
        `A broader ${service.name} package with more flexibility and additional objectives.`,

      price:
        money(
          base * 1.65
        ),

      recommended: true,

      scope:
        "Expanded service scope",

      directLabel:
        "STANDARD UPGRADES",

      directIncludes:
        standardUpgrades,

      allIncludes:
        standardAll,

      inheritsLabel:
        "Everything in Basic",

      inheritanceSummary:
        "Your complete Basic package is already included.",

      inheritedGroups: [
        {
          tier:
            "starter",

          name:
            "Basic",

          items:
            basicIncludes,
        },
      ],
    },

    /* =====================================================
       PREMIUM
    ===================================================== */

    {
      id: "premium",

      tier: "premium",

      name: "Premium",

      label:
        "FULL SERVICE",

      subtitle:
        `The most complete ${service.name} package for larger or higher-priority requests.`,

      price:
        money(
          base * 2.4
        ),

      scope:
        "Largest available scope",

      directLabel:
        "PREMIUM UPGRADES",

      directIncludes:
        premiumUpgrades,

      allIncludes:
        premiumAll,

      inheritsLabel:
        "Everything in Standard",

      inheritanceSummary:
        "Basic and every Standard upgrade are already included.",

      inheritedGroups: [
        {
          tier:
            "starter",

          name:
            "Basic",

          items:
            basicIncludes,
        },

        {
          tier:
            "standard",

          name:
            "Standard Upgrades",

          items:
            standardUpgrades,
        },
      ],
    },

    /* =====================================================
       CUSTOM
    ===================================================== */

    buildCustomPackage(
      service
    ),
  ];
}

/* =========================================================
   DEFAULT PACKAGE

   IMPORTANT:
   Internally the Basic package still has the ID "starter".

   That means all existing BirdShop code continues working,
   but the customer only ever sees "Basic".
========================================================= */

export function getDefaultServicePackageId(
  packages: ServicePackageOption[]
) {
  const basicPackage =
    packages.find(
      (
        item
      ) =>
        item.id ===
        "starter"
    );

  return (
    basicPackage?.id ??
    packages[0]?.id ??
    ""
  );
}
