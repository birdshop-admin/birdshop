"use client";

import Image from "next/image";
import { useState, type JSX, type ReactNode } from "react";

const SUPABASE_PUBLIC_HOST = /^[a-z0-9-]+\.supabase\.co$/i;
const SUPABASE_PUBLIC_PATH = "/storage/v1/object/public/";
// Root-relative only ("/x", never "//x"), and no query string: Next 16 rejects
// local images with a query unless images.localPatterns allows one.
const LOCAL_PATH = /^\/(?!\/)[^?#]+$/;
const UNSAFE_CHARACTERS = /[\s\\]/;

/**
 * Returns the trimmed `src` when next/image may load it with this app's
 * config, otherwise `undefined` (the caller then shows its fallback instead of
 * next/image throwing in development or the optimizer answering 400).
 *
 * Allowed:
 * - a local path starting with "/" (not "//"), without a query string;
 * - a public Supabase Storage URL,
 *   `https://<project>.supabase.co/storage/v1/object/public/...`
 *   (the same host and path as `images.remotePatterns` in next.config.ts).
 *
 * This module is "use client", so call it from client components only.
 */
export function getRenderableImageSrc(src?: string | null): string | undefined {
  if (typeof src !== "string") return undefined;

  const value = src.trim();
  if (!value || UNSAFE_CHARACTERS.test(value)) return undefined;

  if (value.startsWith("/")) {
    return LOCAL_PATH.test(value) ? value : undefined;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return undefined;
  }
  if (!SUPABASE_PUBLIC_HOST.test(url.hostname)) return undefined;
  // The parsed pathname is already normalised, so "../" cannot escape the prefix.
  if (
    !url.pathname.startsWith(SUPABASE_PUBLIC_PATH) ||
    url.pathname.length <= SUPABASE_PUBLIC_PATH.length
  ) {
    return undefined;
  }

  return value;
}

export type CatalogArtworkProps = {
  src?: string | null;
  /** Empty by default: the card or row usually names the item already. */
  alt?: string;
  sizes: string;
  /** Defaults to "cover". */
  fit?: "cover" | "contain";
  /** Inner padding in px, applied only with fit="contain". */
  padding?: number;
  /** next/image `preload` (a <link rel="preload"> in the head). At most one per page. */
  preload?: boolean;
  className?: string;
  /** Rendered when there is no usable src or the image fails to load. */
  fallback: ReactNode;
};

/**
 * A catalog image that fills its parent. The parent must be
 * `position: relative; overflow: hidden`.
 */
export default function CatalogArtwork({
  src,
  alt = "",
  sizes,
  fit = "cover",
  padding = 0,
  preload = false,
  className,
  fallback,
}: CatalogArtworkProps): JSX.Element {
  const usable = getRenderableImageSrc(src);
  // Keyed by src: a new src gets a fresh attempt, the failed one stays failed.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!usable || failedSrc === usable) return <>{fallback}</>;

  return (
    <Image
      key={usable}
      src={usable}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      className={className}
      style={
        fit === "contain" && padding > 0
          ? { objectFit: fit, padding }
          : { objectFit: fit }
      }
      onError={() => setFailedSrc(usable)}
    />
  );
}
