"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function PublicProductCounter() {
  const [sold, setSold] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stopped = false;
    void Promise.resolve(createClient().rpc("birdshop_public_store_stats"))
      .then(({ data, error }) => {
        if (stopped) return;
        const value = Number(
          (Array.isArray(data) ? data[0] : data)?.products_sold,
        );
        if (error || !Number.isFinite(value)) {
          setFailed(true);
          return;
        }
        setSold(value);
      })
      .catch(() => {
        if (!stopped) setFailed(true);
      });
    return () => {
      stopped = true;
    };
  }, []);
  return (
    <div aria-live="polite">
      <strong>
        {sold === null
          ? failed
            ? "Sales count unavailable"
            : "—"
          : sold.toLocaleString("en-US") +
            " " +
            (sold === 1 ? "Product Sold" : "Products Sold")}
      </strong>
      <span>Verified product sales</span>
    </div>
  );
}
