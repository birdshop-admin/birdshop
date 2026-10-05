"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export default function SiteAnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    let sessionId = crypto.randomUUID();
    try {
      sessionId = localStorage.getItem("birdshop-visitor-id-v1") || sessionId;
      localStorage.setItem("birdshop-visitor-id-v1", sessionId);
    } catch {
      /* Counts remain approximate without storage. */
    }
    const track = (recordView: boolean) => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, path: pathname, recordView }),
      }).catch(() => undefined);
    };
    let record = true;
    try {
      const key = `birdshop-last-view:${pathname}`;
      record = Date.now() - Number(sessionStorage.getItem(key) || 0) > 1500;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* Best effort deduplication. */
    }
    track(record);
    const timer = setInterval(() => track(false), 60_000);
    const visible = () => track(false);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pathname]);
  return null;
}
