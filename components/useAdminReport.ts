"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAdminReport<T>(rpc: string, days?: number | null) {
  const [result, setResult] = useState<{ key: string; data: T } | null>(null);
  const [error, setError] = useState("");
  const key = rpc + ":" + String(days);
  useEffect(() => {
    const db = createClient();
    let stopped = false,
      busy = false;
    async function refresh() {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const { data, error } = await db.rpc(
          rpc,
          days === undefined ? undefined : { p_days: days },
        );
        if (error || !data) throw Error();
        if (!stopped) {
          setResult({ key, data: data as T });
          setError("");
        }
      } catch {
        if (!stopped)
          setError(
            "Unable to refresh these figures. Please try again shortly.",
          );
      } finally {
        busy = false;
      }
    }
    void refresh();
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [rpc, days, key]);
  return { data: result?.key === key ? result.data : null, error };
}
