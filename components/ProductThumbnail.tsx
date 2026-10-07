"use client";
import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/lib/products";
export default function ProductThumbnail({ product }: { product: Product }) {
  const src = product.gallery.find((item) => item.src)?.src;
  const [failed, setFailed] = useState<string | undefined>();
  if (!src || failed === src) return <span>{product.initials}</span>;
  return <Image src={src} alt={product.name} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 350px" style={{ objectFit: "contain", padding: 6 }} onError={() => setFailed(src)} />;
}
