"use server";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
const text = (f: FormData, k: string, max: number) =>
  String(f.get(k) ?? "")
    .trim()
    .slice(0, max);
export async function saveService(
  _state: { error: string; success: string },
  f: FormData,
) {
  const { user } = await requireOwner();
  const slug = text(f, "slug", 100),
    name = text(f, "name", 100),
    description = text(f, "description", 2000),
    game = text(f, "game", 80),
    category = text(f, "category", 80);
  if (
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ||
    name.length < 2 ||
    description.length < 10 ||
    !game ||
    !category
  )
    return {
      error: "Enter a URL slug, service name, game, category and description.",
      success: "",
    };
  const customOnly = f.get("customOnly") === "on";
  const packages = [];
  for (const [id, label] of [
    ["starter", "Basic"],
    ["standard", "Standard"],
    ["premium", "Premium"],
  ]) {
    const price = text(f, id + "_price", 15),
      scope = text(f, id + "_scope", 500),
      includes = text(f, id + "_includes", 1200)
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 15),
      enabled = f.get(id + "_enabled") === "on";
    let cents: number | null = null;
    if (price) {
      if (!/^\d{1,6}(\.\d{1,2})?$/.test(price))
        return {
          error: label + ": use a price with at most two decimals.",
          success: "",
        };
      const [whole, decimal = ""] = price.split(".");
      cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
    }
    if (
      !customOnly && enabled &&
      (cents === null ||
        cents < 50 ||
        cents > 99999999 ||
        scope.length < 5 ||
        !includes.length)
    )
      return {
        error:
          label +
          ": enter a price of at least $0.50, a clear scope and included work before enabling purchases.",
        success: "",
      };
    packages.push({ id, name: label, enabled, cents, scope, includes });
  }
  const data = {
    customOnly,
    slug,
    name,
    game,
    category,
    description,
    shortDescription: description.slice(0, 240),
    initials: name
      .split(/\s+/)
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    turnaround: text(f, "turnaround", 100) || "Confirmed in chat",
    delivery: "Private service chat",
    available: f.get("available") === "on",
    featured: f.get("featured") === "on",
    features: text(f, "features", 1500)
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12),
    startingPrice: customOnly ? null : packages
      .filter((p) => p.enabled)
      .reduce<number | null>(
        (n, p) => (n === null ? p.cents! / 100 : Math.min(n, p.cents! / 100)),
        null,
      ),
  };
  const db = createAdminClient(),
    record = {
      slug,
      data,
      packages,
      is_visible: f.get("visible") === "on",
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
  const result =
    f.get("existing") === "yes"
      ? await db
          .from("birdshop_services")
          .update(record)
          .eq("slug", slug)
          .is("deleted_at", null)
          .select("slug")
          .single()
      : await db.from("birdshop_services").insert(record);
  if (result.error)
    return {
      error:
        "Could not save. Check that a new service uses a unique slug, then retry.",
      success: "",
    };
  revalidatePath("/", "layout");
  return {
    error: "",
    success: "Service saved.",
  };
}
export async function deleteService(
  _state: { error: string; success: string },
  f: FormData,
) {
  const { user } = await requireOwner();
  const slug = text(f, "slug", 100);
  const { error } = await createAdminClient()
    .from("birdshop_services")
    .update({
      is_visible: false,
      deleted_at: new Date().toISOString(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);
  if (error)
    return { error: "Could not remove this service. Retry.", success: "" };
  revalidatePath("/", "layout");
  return {
    error: "",
    success:
      "Service removed from the catalog. Existing purchases and chats are retained.",
  };
}
