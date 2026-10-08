/*
 * Service model shared by the storefront, the admin and the API routes.
 * Plain module: no "use client" and no "server-only", so client components
 * (the admin uploader, ServiceImage/CatalogArtwork callers) can import the
 * constants and helpers below.
 */

export type ServiceTierId = "starter" | "standard" | "premium";

export type ServicePlan = {
  id: ServiceTierId;
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

  /**
   * Public Supabase Storage URL of the service artwork:
   * `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/services/<slug>/<uuid>.<png|jpg|webp>`.
   * getServices() already sanitises it (see serviceImageUrl); null or absent
   * means "show the monogram seal".
   */
  image?: string | null;
};

/**
 * Reads a stored service flag (customOnly, available, featured) the way the
 * checkout SQL's ::boolean cast does: JSON true, or a Postgres-style true
 * string. Shared by the storefront catalog and the admin so both agree.
 */
export function parseServiceFlag(value: unknown): boolean {
  if (value === true) return true;

  if (typeof value !== "string" && typeof value !== "number") return false;

  return ["true", "t", "yes", "y", "on", "1"].includes(
    String(value).trim().toLowerCase(),
  );
}

/* =========================================================
   SERVICE IMAGES
========================================================= */

/** Same public-read, owner-write bucket as product artwork. */
export const SERVICE_IMAGE_BUCKET = "product-images";

/** Matches the bucket's file_size_limit (8388608). */
export const SERVICE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type ServiceImageExtension = "png" | "jpg" | "webp";

/**
 * Allowed upload MIME types → file extension. Null prototype, so a crafted
 * type such as "constructor" never resolves to an inherited value.
 */
export const SERVICE_IMAGE_TYPES: Readonly<
  Partial<Record<string, ServiceImageExtension>>
> = Object.freeze(
  Object.assign(
    Object.create(null) as Record<string, ServiceImageExtension>,
    {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    },
  ),
);

/** Extension for an allowed MIME type, otherwise null. */
export function serviceImageExtension(
  type: unknown,
): ServiceImageExtension | null {
  return typeof type === "string" ? (SERVICE_IMAGE_TYPES[type] ?? null) : null;
}

/** `accept` attribute for the admin file input. */
export const SERVICE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * MIME type read from the file signature (magic bytes), or null when the bytes
 * are not a PNG, JPEG or WEBP image. The server compares this with the
 * declared type, so a renamed file is refused.
 */
export function sniffServiceImageType(
  bytes: Uint8Array,
): "image/png" | "image/jpeg" | "image/webp" | null {
  const starts = (offset: number, signature: number[]) =>
    bytes.length >= offset + signature.length &&
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (starts(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (starts(0, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // "RIFF" <size> "WEBP"
  if (
    starts(0, [0x52, 0x49, 0x46, 0x46]) &&
    starts(8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }

  return null;
}

const SERVICE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SERVICE_IMAGE_OBJECT =
  /^services\/([a-z0-9]+(?:-[a-z0-9]+)*)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/;

/*
 * Public object prefix for the bucket, built exactly the way supabase-js
 * builds getPublicUrl(): new URL("storage/v1", <url>/) + "/object/public/<bucket>/".
 * NEXT_PUBLIC_ is inlined at build time, so this also works in the browser.
 */
function publicBucketPrefix(): string | null {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!configured) return null;

  try {
    const storage = new URL(
      "storage/v1",
      configured.endsWith("/") ? configured : `${configured}/`,
    );

    return `${storage.href}/object/public/${SERVICE_IMAGE_BUCKET}/`;
  } catch {
    return null;
  }
}

/**
 * Returns the storage object path (`services/<slug>/<uuid>.<ext>`) when `url`
 * is a public URL of this project's service-image folder, otherwise null.
 * When `slug` is given, the folder must belong to that service.
 * Used for sanitising catalog reads and for safe deletes in the admin.
 */
export function serviceImagePath(url: unknown, slug?: string): string | null {
  if (typeof url !== "string") return null;

  const prefix = publicBucketPrefix();

  if (!prefix || !url.startsWith(prefix)) return null;

  const path = url.slice(prefix.length);
  const match = SERVICE_IMAGE_OBJECT.exec(path);

  if (!match || (slug !== undefined && match[1] !== slug)) return null;

  return path;
}

/** `url` itself when it passes serviceImagePath(url, slug), otherwise null. */
export function serviceImageUrl(url: unknown, slug?: string): string | null {
  return typeof url === "string" && serviceImagePath(url, slug) ? url : null;
}

/** New object path for an upload; always passes serviceImagePath once made public. */
export function createServiceImagePath(
  slug: string,
  extension: ServiceImageExtension,
): string {
  if (!SERVICE_SLUG.test(slug)) {
    throw new Error("A valid service slug is required for its image.");
  }

  return `services/${slug}/${crypto.randomUUID()}.${extension}`;
}
