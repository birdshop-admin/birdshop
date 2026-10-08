"use server";

import { revalidatePath } from "next/cache";

import {
  SERVICE_TIERS,
  SERVICE_TIER_NAMES,
  publishedTiers,
} from "@/lib/service-packages";
import {
  SERVICE_IMAGE_BUCKET,
  SERVICE_IMAGE_MAX_BYTES,
  createServiceImagePath,
  serviceImageExtension,
  serviceImagePath,
  serviceImageUrl,
  sniffServiceImageType,
  type ServicePlan,
} from "@/lib/services";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionState = { error: string; success: string };

type OwnerClient = Awaited<ReturnType<typeof requireOwner>>["supabase"];

const SHORT_DESCRIPTION_MAX = 160;

const fail = (error: string): ActionState => ({ error, success: "" });

const text = (f: FormData, k: string, max: number) =>
  String(f.get(k) ?? "")
    .trim()
    .slice(0, max);

const lines = (value: string, max: number) =>
  value
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stored(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((x) => x[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* Card summary: the whole text when short, else its first sentence, else a
   cut at a word boundary (never mid-word). */
function summarize(value: string, max = SHORT_DESCRIPTION_MAX) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= max) return clean;

  const sentence = /^.{20,}?[.!?](?=\s|$)/.exec(clean)?.[0];

  if (sentence && sentence.length <= max) return sentence;

  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");

  return `${(space > 60 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

function defaultPackages(): ServicePlan[] {
  return SERVICE_TIERS.map((id) => ({
    id,
    name: SERVICE_TIER_NAMES[id],
    enabled: false,
    cents: null,
    scope: "",
    includes: [],
  }));
}

/* Deleting artwork is best-effort: an orphaned file is harmless, a failed
   save is not. */
async function removeImages(supabase: OwnerClient, paths: string[]) {
  if (paths.length === 0) return;

  try {
    await supabase.storage.from(SERVICE_IMAGE_BUCKET).remove(paths);
  } catch {
    /* ignore */
  }
}

export async function saveService(
  _state: ActionState,
  f: FormData,
): Promise<ActionState> {
  // Owner session: Storage writes go through the owner-only RLS policies
  // (like product artwork); the table write uses the service role.
  const { supabase, user } = await requireOwner();

  const existing = f.get("existing") === "yes";

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
    return fail(
      "Enter a URL slug, service name, game, category and description.",
    );

  // "Pricing type" control; the old checkbox name is still accepted.
  const customOnly =
    f.get("pricingType") === "custom" || f.get("customOnly") === "on";

  /* -------------------------------------------------------
     CURRENT ROW (keeps unknown keys such as the seeded badge,
     the stored packages in custom mode, and the previous image)
  ------------------------------------------------------- */

  const db = createAdminClient();

  let current: { data: Record<string, unknown>; packages: unknown } | null =
    null;

  if (existing) {
    const { data, error } = await db
      .from("birdshop_services")
      .select("data,packages")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return fail("This service could not be loaded. Refresh and retry.");

    if (!data) return fail("This service no longer exists. Refresh and retry.");

    current = { data: record(data.data), packages: data.packages };
  } else {
    // Removed services keep their row, so their slug stays taken.
    const { data, error } = await db
      .from("birdshop_services")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();

    if (error) return fail("The URL slug could not be checked. Retry.");

    if (data)
      return fail(
        "That URL slug is already used by another service (or a removed one). Choose a different slug.",
      );
  }

  /* -------------------------------------------------------
     PACKAGES (validated before any upload, so a bad price
     never leaves an orphaned file)
  ------------------------------------------------------- */

  let packages: unknown[];

  if (customOnly) {
    // The package fields are disabled in this mode and not submitted: keep
    // the stored settings untouched for a later switch back.
    packages = Array.isArray(current?.packages)
      ? current.packages
      : defaultPackages();
  } else {
    const parsed: ServicePlan[] = [];

    for (const id of SERVICE_TIERS) {
      const label = SERVICE_TIER_NAMES[id];
      const price = text(f, id + "_price", 15),
        scope = text(f, id + "_scope", 500),
        includes = lines(text(f, id + "_includes", 1200), 15),
        enabled = f.get(id + "_enabled") === "on";

      let cents: number | null = null;

      if (price) {
        if (!/^\d{1,6}(\.\d{1,2})?$/.test(price))
          return fail(label + ": use a price with at most two decimals.");

        const [whole, decimal = ""] = price.split(".");
        cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
      }

      if (
        enabled &&
        (cents === null ||
          cents < 50 ||
          cents > 99999999 ||
          scope.length < 5 ||
          !includes.length)
      )
        return fail(
          label +
            ": enter a price of at least $0.50, a clear scope and included work before enabling purchases.",
        );

      parsed.push({ id, name: label, enabled, cents, scope, includes });
    }

    packages = parsed;
  }

  // Same rule as the storefront and checkout.
  const live = publishedTiers({
    customOnly,
    packages: packages as ServicePlan[],
  });

  /* -------------------------------------------------------
     IMAGE (type and size checked on the server; the file
     signature decides the stored type; every upload gets a
     new unique path, so cached copies never go stale)
  ------------------------------------------------------- */

  const previous = serviceImageUrl(current?.data.image, slug);
  const entry = f.get("image_file");
  const file = entry instanceof File && entry.size > 0 ? entry : null;

  let image: string | null =
    f.get("image_remove") === "true" ? null : previous;
  let uploadedPath: string | null = null;

  if (file) {
    if (
      !serviceImageExtension(file.type) ||
      file.size > SERVICE_IMAGE_MAX_BYTES
    )
      return fail(
        "The service image must be a PNG, JPG or WEBP file up to 8 MB. Nothing was saved.",
      );

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffServiceImageType(bytes);
    const extension = serviceImageExtension(type);

    if (!type || !extension)
      return fail(
        "That file is not a valid PNG, JPG or WEBP image. Nothing was saved.",
      );

    const path = createServiceImagePath(slug, extension);

    const { error } = await supabase.storage
      .from(SERVICE_IMAGE_BUCKET)
      .upload(path, bytes, {
        contentType: type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (error)
      return fail(
        "The image could not be uploaded. Nothing was saved. Please retry.",
      );

    uploadedPath = path;

    const { data } = supabase.storage
      .from(SERVICE_IMAGE_BUCKET)
      .getPublicUrl(path);

    // Store only an address the storefront will accept.
    image = serviceImageUrl(data.publicUrl, slug);

    if (!image) {
      await removeImages(supabase, [path]);

      return fail(
        "The image address did not match this project's storage, so nothing was saved. Check NEXT_PUBLIC_SUPABASE_URL and retry.",
      );
    }
  }

  /* -------------------------------------------------------
     SAVE
  ------------------------------------------------------- */

  const previousData = current?.data ?? {};
  const shortInput = text(f, "shortDescription", 2000);

  const data = {
    // Keep keys the editor does not show (e.g. the seeded badge).
    ...previousData,
    customOnly,
    slug,
    name,
    game,
    category,
    description,
    shortDescription: f.has("shortDescription")
      ? summarize(shortInput || description)
      : stored(previousData.shortDescription) || summarize(description),
    initials:
      stored(previousData.name) === name && stored(previousData.initials)
        ? stored(previousData.initials)
        : initialsOf(name),
    turnaround: text(f, "turnaround", 100) || "Confirmed in chat",
    delivery: stored(previousData.delivery) || "Private service chat",
    available: f.get("available") === "on",
    featured: f.get("featured") === "on",
    features: lines(text(f, "features", 1500), 12),
    startingPrice: live.length
      ? Math.min(...live.map((p) => p.cents)) / 100
      : null,
    image,
  };

  const row = {
    slug,
    data,
    packages,
    is_visible: f.get("visible") === "on",
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const result = existing
    ? await db
        .from("birdshop_services")
        .update(row)
        .eq("slug", slug)
        .is("deleted_at", null)
        .select("slug")
        .single()
    : await db.from("birdshop_services").insert(row);

  if (result.error) {
    if (uploadedPath) await removeImages(supabase, [uploadedPath]);

    return fail(
      existing
        ? "Could not save. Refresh and retry; nothing was changed."
        : "Could not save. Check that a new service uses a unique slug, then retry.",
    );
  }

  // Only after the row points at the new artwork: drop the replaced file.
  const previousPath = serviceImagePath(previous, slug);

  if (previousPath && previous !== image) {
    await removeImages(supabase, [previousPath]);
  }

  revalidatePath("/", "layout");

  return {
    error: "",
    success: customOnly
      ? "Saved. Customers now see this service as Custom quote only, with no packages."
      : live.length === 0
        ? "Saved. No package is live yet, so customers see a custom quote until you enable one."
        : "Service saved.",
  };
}

export async function deleteService(
  _state: ActionState,
  f: FormData,
): Promise<ActionState> {
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
  if (error) return fail("Could not remove this service. Retry.");
  revalidatePath("/", "layout");
  return {
    error: "",
    success:
      "Service removed from the catalog. Existing purchases and chats are retained.",
  };
}
