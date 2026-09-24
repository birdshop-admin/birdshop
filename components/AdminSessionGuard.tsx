"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  ADMIN_HEARTBEAT_INTERVAL_MS,
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_IDLE_WARNING_MS,
  ADMIN_TAB_STORAGE_KEY,
} from "@/lib/admin-session";

import styles from "./AdminSessionGuard.module.css";

type AdminSessionGuardProps = {
  children: ReactNode;
};

export default function AdminSessionGuard({
  children,
}: AdminSessionGuardProps) {
  const [
    ready,
    setReady,
  ] = useState(false);

  const [
    warningVisible,
    setWarningVisible,
  ] = useState(false);

  const [
    secondsRemaining,
    setSecondsRemaining,
  ] = useState(
    Math.ceil(
      ADMIN_IDLE_WARNING_MS /
        1000
    )
  );

  const lastActivityRef =
    useRef(0);

  const lastHeartbeatRef =
    useRef(0);

  const warningVisibleRef =
    useRef(false);

  const signingOutRef =
    useRef(false);

  const intentionalNavigationRef =
    useRef(false);

  const warningTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const logoutTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const countdownIntervalRef =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  useEffect(() => {
    /* =====================================================
       TIMER HELPERS
    ===================================================== */

    function clearTimers() {
      if (
        warningTimeoutRef.current
      ) {
        clearTimeout(
          warningTimeoutRef.current
        );

        warningTimeoutRef.current =
          null;
      }

      if (
        logoutTimeoutRef.current
      ) {
        clearTimeout(
          logoutTimeoutRef.current
        );

        logoutTimeoutRef.current =
          null;
      }

      if (
        countdownIntervalRef.current
      ) {
        clearInterval(
          countdownIntervalRef.current
        );

        countdownIntervalRef.current =
          null;
      }
    }

    function clearTabMarker() {
      window.sessionStorage.removeItem(
        ADMIN_TAB_STORAGE_KEY
      );
    }

    /* =====================================================
       NORMAL LOGOUT
    ===================================================== */

    async function signOut(
      reason:
        | "inactive"
        | "closed"
        | "manual"
    ) {
      if (
        signingOutRef.current
      ) {
        return;
      }

      signingOutRef.current =
        true;

      clearTimers();
      clearTabMarker();

      try {
        await fetch(
          `/admin/logout?reason=${reason}`,
          {
            method: "POST",

            credentials:
              "same-origin",

            cache: "no-store",
          }
        );
      } finally {
        const suffix =
          reason === "inactive"
            ? "?reason=inactive"
            : reason === "closed"
              ? "?reason=closed"
              : "";

        window.location.replace(
          `/admin/login${suffix}`
        );
      }
    }

    /* =====================================================
       STRICT PAGE-CLOSE LOGOUT

       sendBeacon is specifically useful when the page is
       being destroyed because the browser can continue
       sending it while the document is closing.

       This also intentionally applies to hard refresh.
    ===================================================== */

    function logoutOnPageExit() {
      if (
        signingOutRef.current ||
        intentionalNavigationRef.current
      ) {
        return;
      }

      signingOutRef.current =
        true;

      clearTabMarker();

      const url =
        "/admin/logout?reason=closed";

      if (
        navigator.sendBeacon
      ) {
        navigator.sendBeacon(
          url,
          new Blob(
            [""],
            {
              type:
                "text/plain",
            }
          )
        );

        return;
      }

      void fetch(
        url,
        {
          method: "POST",

          credentials:
            "same-origin",

          keepalive: true,
        }
      );
    }

    /* =====================================================
       VERIFY TAB ACCESS
    ===================================================== */

    const tabAuthorized =
      window.sessionStorage.getItem(
        ADMIN_TAB_STORAGE_KEY
      ) === "1";

    if (
      !tabAuthorized
    ) {
      void signOut(
        "closed"
      );

      return;
    }

    setReady(true);

    lastActivityRef.current =
      Date.now();

    /* =====================================================
       HEARTBEAT
    ===================================================== */

    async function heartbeat() {
      const now =
        Date.now();

      if (
        now -
          lastHeartbeatRef.current <
        ADMIN_HEARTBEAT_INTERVAL_MS
      ) {
        return;
      }

      lastHeartbeatRef.current =
        now;

      try {
        const response =
          await fetch(
            "/admin/session/heartbeat",
            {
              method: "POST",

              credentials:
                "same-origin",

              cache: "no-store",

              keepalive: true,
            }
          );

        if (
          response.status ===
            401 ||
          response.status ===
            403
        ) {
          await signOut(
            "inactive"
          );
        }
      } catch {
        /*
         * A temporary connection issue
         * does not immediately terminate
         * the admin session.
         */
      }
    }

    /* =====================================================
       WARNING
    ===================================================== */

    function hideWarning() {
      warningVisibleRef.current =
        false;

      setWarningVisible(
        false
      );

      if (
        countdownIntervalRef.current
      ) {
        clearInterval(
          countdownIntervalRef.current
        );

        countdownIntervalRef.current =
          null;
      }
    }

    function updateCountdown() {
      const expiresAt =
        lastActivityRef.current +
        ADMIN_IDLE_TIMEOUT_MS;

      const remaining =
        Math.max(
          0,
          expiresAt -
            Date.now()
        );

      setSecondsRemaining(
        Math.ceil(
          remaining /
            1000
        )
      );

      if (
        remaining <= 0
      ) {
        void signOut(
          "inactive"
        );
      }
    }

    function showWarning() {
      if (
        signingOutRef.current ||
        warningVisibleRef.current
      ) {
        return;
      }

      warningVisibleRef.current =
        true;

      setWarningVisible(
        true
      );

      updateCountdown();

      countdownIntervalRef.current =
        setInterval(
          updateCountdown,
          1000
        );
    }

    /* =====================================================
       TIMER SCHEDULING
    ===================================================== */

    function scheduleTimers() {
      clearTimers();

      const elapsed =
        Date.now() -
        lastActivityRef.current;

      const warningAfter =
        ADMIN_IDLE_TIMEOUT_MS -
        ADMIN_IDLE_WARNING_MS -
        elapsed;

      const logoutAfter =
        ADMIN_IDLE_TIMEOUT_MS -
        elapsed;

      if (
        logoutAfter <= 0
      ) {
        void signOut(
          "inactive"
        );

        return;
      }

      if (
        warningAfter <= 0
      ) {
        showWarning();
      } else {
        warningTimeoutRef.current =
          setTimeout(
            showWarning,
            warningAfter
          );
      }

      logoutTimeoutRef.current =
        setTimeout(
          () => {
            void signOut(
              "inactive"
            );
          },
          logoutAfter
        );
    }

    /* =====================================================
       ACTIVITY
    ===================================================== */

    function registerActivity() {
      if (
        signingOutRef.current ||
        warningVisibleRef.current
      ) {
        return;
      }

      lastActivityRef.current =
        Date.now();

      scheduleTimers();

      void heartbeat();
    }

    function staySignedIn() {
      if (
        signingOutRef.current
      ) {
        return;
      }

      hideWarning();

      lastActivityRef.current =
        Date.now();

      lastHeartbeatRef.current =
        0;

      scheduleTimers();

      void heartbeat();
    }

    /* =====================================================
       TAB VISIBILITY
    ===================================================== */

    function handleVisibility() {
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      const inactiveFor =
        Date.now() -
        lastActivityRef.current;

      if (
        inactiveFor >=
        ADMIN_IDLE_TIMEOUT_MS
      ) {
        void signOut(
          "inactive"
        );

        return;
      }

      if (
        inactiveFor >=
        ADMIN_IDLE_TIMEOUT_MS -
          ADMIN_IDLE_WARNING_MS
      ) {
        showWarning();

        scheduleTimers();

        return;
      }

      registerActivity();
    }

    /* =====================================================
       PAGE EXIT
    ===================================================== */

    function handlePageHide(
      event:
        PageTransitionEvent
    ) {
      /*
       * If the page enters the browser's
       * back-forward cache, don't kill
       * the session.
       */
      if (
        event.persisted
      ) {
        return;
      }

      logoutOnPageExit();
    }

    function handleBeforeUnload() {
      logoutOnPageExit();
    }

    /* =====================================================
       INTERNAL ADMIN LINKS

       Next.js <Link> navigation should normally not unload
       the document anyway. This also marks genuine internal
       link clicks so they never accidentally trigger the
       close-tab handler.
    ===================================================== */

    function handleDocumentClick(
      event:
        MouseEvent
    ) {
      const target =
        event.target as
          HTMLElement | null;

      const anchor =
        target?.closest(
          "a"
        ) as
          HTMLAnchorElement | null;

      if (
        !anchor
      ) {
        return;
      }

      let targetUrl:
        URL;

      try {
        targetUrl =
          new URL(
            anchor.href,
            window.location.href
          );
      } catch {
        return;
      }

      if (
        targetUrl.origin !==
        window.location.origin
      ) {
        return;
      }

      if (
        targetUrl.pathname ===
          "/admin" ||
        targetUrl.pathname.startsWith(
          "/admin/"
        )
      ) {
        intentionalNavigationRef.current =
          true;

        window.setTimeout(
          () => {
            intentionalNavigationRef.current =
              false;
          },
          1500
        );
      }
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ] as const;

    activityEvents.forEach(
      (
        eventName
      ) => {
        window.addEventListener(
          eventName,
          registerActivity,
          {
            passive: true,
          }
        );
      }
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    document.addEventListener(
      "click",
      handleDocumentClick,
      true
    );

    window.addEventListener(
      "pagehide",
      handlePageHide
    );

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    /* =====================================================
       WARNING BUTTON EVENTS
    ===================================================== */

    function stayEvent() {
      staySignedIn();
    }

    function logoutEvent() {
      void signOut(
        "manual"
      );
    }

    window.addEventListener(
      "birdshop-admin-stay",
      stayEvent
    );

    window.addEventListener(
      "birdshop-admin-logout",
      logoutEvent
    );

    /* =====================================================
       START
    ===================================================== */

    scheduleTimers();

    void heartbeat();

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      activityEvents.forEach(
        (
          eventName
        ) => {
          window.removeEventListener(
            eventName,
            registerActivity
          );
        }
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      document.removeEventListener(
        "click",
        handleDocumentClick,
        true
      );

      window.removeEventListener(
        "pagehide",
        handlePageHide
      );

      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );

      window.removeEventListener(
        "birdshop-admin-stay",
        stayEvent
      );

      window.removeEventListener(
        "birdshop-admin-logout",
        logoutEvent
      );

      clearTimers();
    };
  }, []);

  /* =======================================================
     SESSION GATE
  ======================================================= */

  if (
    !ready
  ) {
    return (
      <div
        className={
          styles.loadingGate
        }
      >
        <span>
          BIRDSHOP ADMIN
        </span>

        <strong>
          Securing session...
        </strong>
      </div>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <>
      {children}

      {warningVisible && (
        <div
          className={
            styles.overlay
          }
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-session-title"
        >
          <div
            className={
              styles.card
            }
          >
            <span
              className={
                styles.eyebrow
              }
            >
              SECURITY TIMEOUT
            </span>

            <h2
              id="admin-session-title"
            >
              Still working?
            </h2>

            <p>
              Your BirdShop
              admin session is
              about to end
              because no activity
              has been detected.
            </p>

            <div
              className={
                styles.countdown
              }
            >
              <strong>
                {
                  secondsRemaining
                }
              </strong>

              <span>
                SECONDS UNTIL
                SIGN OUT
              </span>
            </div>

            <div
              className={
                styles.actions
              }
            >
              <button
                type="button"
                className={
                  styles.stayButton
                }
                onClick={() => {
                  window.dispatchEvent(
                    new Event(
                      "birdshop-admin-stay"
                    )
                  );
                }}
              >
                Stay Signed In
              </button>

              <button
                type="button"
                className={
                  styles.logoutButton
                }
                onClick={() => {
                  window.dispatchEvent(
                    new Event(
                      "birdshop-admin-logout"
                    )
                  );
                }}
              >
                Sign Out Now
              </button>
            </div>

            <p
              className={
                styles.note
              }
            >
              For maximum
              security, closing or
              refreshing the admin
              page ends the admin
              session.
            </p>
          </div>
        </div>
      )}
    </>
  );
}