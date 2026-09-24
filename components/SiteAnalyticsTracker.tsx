"use client";

import {
  useEffect,
  useMemo,
} from "react";

import {
  usePathname,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

const VISITOR_KEY =
  "birdshop-visitor-id-v1";

const HEARTBEAT_MS =
  60_000;

const VIEW_DEDUP_MS =
  1_500;

function getVisitorId() {
  try {
    const existing =
      window.localStorage.getItem(
        VISITOR_KEY
      );

    if (existing) {
      return existing;
    }

    const created =
      window.crypto.randomUUID();

    window.localStorage.setItem(
      VISITOR_KEY,
      created
    );

    return created;
  } catch {
    return window.crypto.randomUUID();
  }
}

function shouldRecordView(
  pathname: string
) {
  try {
    const key =
      `birdshop-last-view:${pathname}`;

    const now =
      Date.now();

    const previous =
      Number(
        window.sessionStorage.getItem(
          key
        ) ??
        0
      );

    window.sessionStorage.setItem(
      key,
      String(now)
    );

    return (
      !Number.isFinite(previous) ||
      now - previous >
        VIEW_DEDUP_MS
    );
  } catch {
    return true;
  }
}

export default function SiteAnalyticsTracker() {
  const pathname =
    usePathname();

  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  useEffect(() => {
    if (
      !pathname ||
      pathname.startsWith(
        "/admin"
      )
    ) {
      return;
    }

    const visitorId =
      getVisitorId();

    let disposed = false;

    function track(
      recordView: boolean
    ) {
      if (
        disposed ||
        document.visibilityState ===
          "hidden"
      ) {
        return;
      }

      void supabase.rpc(
        "birdshop_track_activity",
        {
          p_session_id:
            visitorId,
          p_path:
            pathname,
          p_record_view:
            recordView,
        }
      );
    }

    track(
      shouldRecordView(
        pathname
      )
    );

    const heartbeat =
      window.setInterval(
        () => {
          track(false);
        },
        HEARTBEAT_MS
      );

    function handleVisibility() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        track(false);
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      disposed = true;

      window.clearInterval(
        heartbeat
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    pathname,
    supabase,
  ]);

  return null;
}
