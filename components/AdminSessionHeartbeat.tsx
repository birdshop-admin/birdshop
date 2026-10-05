"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminSessionHeartbeat() {
  const router = useRouter();
  useEffect(() => {
    let busy = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || busy) return;
      busy = true;
      try {
        const response = await fetch("/admin/session/heartbeat", {
          method: "POST",
          cache: "no-store",
        });
        if (response.status === 401 || response.status === 403)
          router.replace("/admin/login?reason=session");
      } catch {
        /* A temporary network failure must not sign out every tab. */
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
