"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

type StoreStats = {
  products_sold:
    | number
    | string;
};

export default function PublicProductCounter() {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [
    productsSold,
    setProductsSold,
  ] = useState(0);

  useEffect(() => {
    let cancelled =
      false;

    void supabase
      .rpc(
        "birdshop_public_store_stats"
      )
      .then(
        ({ data }) => {
          if (cancelled) {
            return;
          }

          const row =
            Array.isArray(data)
              ? data[0]
              : data;

          const value =
            Number(
              (
                row as
                  | StoreStats
                  | null
              )
                ?.products_sold ??
                0
            );

          setProductsSold(
            Number.isFinite(
              value
            )
              ? Math.max(
                  0,
                  value
                )
              : 0
          );
        }
      );

    return () => {
      cancelled = true;
    };
  }, [
    supabase,
  ]);

  return (
    <div
      aria-live="polite"
    >
      <strong>
        {productsSold.toLocaleString(
          "en-US"
        )}{" "}
        {productsSold === 1
          ? "Product Delivered"
          : "Products Delivered"}
      </strong>

      <span>
        VERIFIED PRODUCT SALES
      </span>
    </div>
  );
}
