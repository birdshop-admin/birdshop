import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Service } from "@/lib/services";
export async function getServices(): Promise<Service[]> {
  const { data, error } = await createAdminClient()
    .from("birdshop_services")
    .select("slug,data,packages")
    .eq("is_visible", true)
    .is("deleted_at", null)
    .order("slug");
  if (error) throw new Error("Services could not be loaded. Please retry.");
  return (data ?? []).map((row) => {
    const packages = (row.packages as NonNullable<Service["packages"]>).map(
      (p) => p.enabled && p.cents !== null ? p : { id: p.id, name: p.name, enabled: false, cents: null, scope: "", includes: [] },
    );
    const published = packages.filter((p) => p.enabled && p.cents !== null);
    return {
      ...row.data,
      slug: row.slug,
      packages,
      startingPrice: published.length
        ? Math.min(...published.map((p) => p.cents! / 100))
        : null,
    } as Service;
  });
}
export async function getService(slug: string) {
  return (await getServices()).find((s) => s.slug === slug);
}
