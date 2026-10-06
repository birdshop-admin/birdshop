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
    const packages = (row.packages as NonNullable<Service["packages"]>).filter(
      (p) => p.enabled && p.cents !== null,
    );
    return {
      ...row.data,
      slug: row.slug,
      packages,
      startingPrice: packages.length
        ? Math.min(...packages.map((p) => p.cents! / 100))
        : null,
    } as Service;
  });
}
export async function getService(slug: string) {
  return (await getServices()).find((s) => s.slug === slug);
}
