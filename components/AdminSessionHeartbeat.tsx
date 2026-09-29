"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  ADMIN_HEARTBEAT_INTERVAL_MS,
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_RECENT_ACTIVITY_MS,
} from "@/lib/admin-session";

/* =========================================================
   COMPONENT
========================================================= */

export default function AdminSessionHeartbeat() {
  const lastActivityRef =
    useRef(
      Date.now()
    );

  const heartbeatRunningRef =
    useRef(
      false
    );

  const sessionEndingRef =
    useRef(
      false
    );

  /* =======================================================
     END SESSION
  ======================================================= */

  const endSession =
    useCallback(
      (
        reason:
          "inactive"
          | "session"
      ) => {
        if (
          sessionEndingRef.current
        ) {
          return;
        }

        sessionEndingRef.current =
          true;

        window.location.replace(
          `/admin/logout?reason=${encodeURIComponent(
            reason
          )}`
        );
      },
      []
    );

  /* =======================================================
     HEARTBEAT
  ======================================================= */

  const sendHeartbeat =
    useCallback(
      async () => {
        if (
          heartbeatRunningRef.current ||
          sessionEndingRef.current
        ) {
          return;
        }

        heartbeatRunningRef.current =
          true;

        try {
          const response =
            await fetch(
              "/admin/session/heartbeat",
              {
                method:
                  "POST",

                credentials:
                  "same-origin",

                cache:
                  "no-store",
              }
            );

          if (
            response.status ===
            440
          ) {
            endSession(
              "inactive"
            );

            return;
          }

          if (
            response.status ===
              401 ||
            response.status ===
              403
          ) {
            endSession(
              "session"
            );

            return;
          }

          if (
            !response.ok
          ) {
            return;
          }
        } catch {
          /*
           * Temporary network failure should not instantly
           * destroy a valid admin session.
           *
           * The server timeout remains authoritative.
           */
        } finally {
          heartbeatRunningRef.current =
            false;
        }
      },
      [
        endSession,
      ]
    );

  /* =======================================================
     REAL USER ACTIVITY
  ======================================================= */

  useEffect(() => {
    function recordActivity() {
      lastActivityRef.current =
        Date.now();
    }

    const activityEvents = [
      "pointerdown",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ] as const;

    activityEvents.forEach(
      (
        eventName
      ) => {
        window.addEventListener(
          eventName,
          recordActivity,
          {
            passive:
              true,
          }
        );
      }
    );

    /*
     * Initial protected page load counts as activity.
     */

    void sendHeartbeat();

    /* =====================================================
       PERIODIC CHECK

       Heartbeat is sent ONLY when the person has actually
       interacted recently.

       Background polling / chat syncing cannot keep the
       admin session alive forever.
    ===================================================== */

    const interval =
      window.setInterval(
        () => {
          const now =
            Date.now();

          const idleFor =
            now -
            lastActivityRef.current;

          if (
            idleFor >=
            ADMIN_IDLE_TIMEOUT_MS
          ) {
            endSession(
              "inactive"
            );

            return;
          }

          if (
            idleFor <=
            ADMIN_RECENT_ACTIVITY_MS
          ) {
            void sendHeartbeat();
          }
        },
        ADMIN_HEARTBEAT_INTERVAL_MS
      );

    return () => {
      window.clearInterval(
        interval
      );

      activityEvents.forEach(
        (
          eventName
        ) => {
          window.removeEventListener(
            eventName,
            recordActivity
          );
        }
      );
    };
  }, [
    sendHeartbeat,
    endSession,
  ]);

  return null;
}