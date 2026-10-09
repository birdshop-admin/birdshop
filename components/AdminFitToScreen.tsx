"use client";

import { useLayoutEffect } from "react";

import { adminZoomFor } from "@/lib/admin-fit";

// Keeps --admin-zoom current while the admin is open: on mount (covers client
// navigation into the admin, where the <head> script doesn't run), and on every
// resize. See lib/admin-fit.ts.
export default function AdminFitToScreen() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const supported = typeof CSS !== "undefined" && CSS.supports("zoom", "0.5");
      root.style.setProperty(
        "--admin-zoom",
        String(adminZoomFor(window.innerWidth, window.innerHeight, supported)),
      );
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return null;
}
