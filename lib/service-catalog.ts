import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseServiceFlag as flag,
  serviceImageUrl,
  type Service,
  type ServicePlan,
} from "@/lib/services";
import {
  SERVICE_TIERS,
  SERVICE_TIER_NAMES,
  publishedTiers,
} from "@/lib/service-packages";

type ServiceRow = { slug: string; data: unknown; packages: unknown };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter((item) => item.length > 0)
    : [];
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .map((word) => word[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "BS"
  );
}

/*
 * Normalise one row instead of spreading raw jsonb onto the client:
 * - unpublished tiers (and every tier of a customOnly service) are stripped
 *   to a disabled placeholder, so their draft prices never reach the browser;
 * - a tier is published only under the same rules checkout enforces, so the
 *   storefront never offers a package that checkout would refuse;
 * - image is null unless it is this project's public URL under
 *   product-images/services/<slug>/.
 */
function toService(row: ServiceRow): Service {
  const d = record(row.data);
  const customOnly = flag(d.customOnly);
  const live = publishedTiers({
    customOnly,
    packages: (Array.isArray(row.packages)
      ? row.packages
      : []) as ServicePlan[],
  });

  const packages: ServicePlan[] = SERVICE_TIERS.map((id) => {
    const plan = live.find((p) => p.id === id);

    return plan
      ? {
          id,
          name: SERVICE_TIER_NAMES[id],
          enabled: true,
          cents: plan.cents,
          scope: plan.scope.trim(),
          includes: strings(plan.includes),
        }
      : {
          id,
          name: SERVICE_TIER_NAMES[id],
          enabled: false,
          cents: null,
          scope: "",
          includes: [],
        };
  });

  const name = text(d.name) || row.slug;
  const description = text(d.description);
  const badge = text(d.badge);

  return {
    slug: row.slug,
    name,
    game: text(d.game),
    category: text(d.category),
    initials: text(d.initials) || initialsOf(name),
    shortDescription: text(d.shortDescription) || description,
    description,
    startingPrice: live.length
      ? Math.min(...live.map((p) => p.cents)) / 100
      : null,
    turnaround: text(d.turnaround) || "Confirmed in chat",
    delivery: text(d.delivery) || "Private service chat",
    ...(badge ? { badge } : {}),
    featured: flag(d.featured),
    available: flag(d.available),
    features: strings(d.features),
    customOnly,
    packages,
    image: serviceImageUrl(d.image, row.slug),
  };
}

/* React cache: the page and generateMetadata share one query per request. */
export const getServices = cache(async (): Promise<Service[]> => {
  const { data, error } = await createAdminClient()
    .from("birdshop_services")
    .select("slug,data,packages")
    .eq("is_visible", true)
    .is("deleted_at", null)
    .order("slug");

  if (error) throw new Error("Services could not be loaded. Please retry.");

  return ((data ?? []) as ServiceRow[]).map(toService);
});

export const getService = cache(
  async (slug: string): Promise<Service | undefined> =>
    (await getServices()).find((s) => s.slug === slug),
);
