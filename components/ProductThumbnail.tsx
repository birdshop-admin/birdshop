"use client";

import type { JSX } from "react";
import CatalogArtwork, { getRenderableImageSrc } from "@/components/CatalogArtwork";
import type { Product } from "@/lib/products";

const DEFAULT_SIZES = "(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 350px";

export type ProductThumbnailProps = {
  product: Product;
  /** Defaults to the product name. Pass "" when the name is shown next to it. */
  alt?: string;
  sizes?: string;
  fit?: "cover" | "contain";
  padding?: number;
  preload?: boolean;
  className?: string;
};

/**
 * The first renderable gallery image of a product, or its initials seal.
 * The parent must be `position: relative; overflow: hidden`; set
 * `--seal-size` on it to size the fallback seal.
 */
export default function ProductThumbnail({
  product,
  alt,
  sizes = DEFAULT_SIZES,
  fit = "contain",
  padding = 6,
  preload,
  className,
}: ProductThumbnailProps): JSX.Element {
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  // Skip entries next/image cannot load (empty, or from an unconfigured host).
  const src = gallery.find((item) => getRenderableImageSrc(item?.src))?.src;
  const label = alt ?? product.name;
  const initials = product.initials || "BS";

  return (
    <CatalogArtwork
      src={src}
      alt={label}
      sizes={sizes}
      fit={fit}
      padding={padding}
      preload={preload}
      className={className}
      fallback={
        label ? (
          <span className="catalog-artwork-fallback" role="img" aria-label={label}>
            {initials}
          </span>
        ) : (
          <span className="catalog-artwork-fallback" aria-hidden="true">
            {initials}
          </span>
        )
      }
    />
  );
}
