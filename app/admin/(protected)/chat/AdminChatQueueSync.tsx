"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import { claimConversationForCurrentStaff } from "./claim-actions";

/* =========================================================
   SETTINGS
========================================================= */

const FALLBACK_REFRESH_MS = 20 * 1000;

const REFRESH_DEBOUNCE_MS = 250;

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/*
 * Rather than hard-coding the query value used by the
 * In Progress tab, locate the actual existing tab in the
 * rendered Owner interface.
 *
 * This means this component follows whatever URL structure
 * OwnerAdminChatPage is already using.
 */

function getInProgressUrl(conversationId: string) {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/admin/chat"]'),
  );

  const inProgressLink = links.find((link) => {
    const text = normalizeText(link.textContent);

    return text === "in progress" || text.startsWith("in progress ");
  });

  if (!inProgressLink) {
    return null;
  }

  const target = new URL(inProgressLink.href, window.location.origin);

  const current = new URL(window.location.href);

  /*
   * Keep whichever conversation category is currently
   * selected:
   *
   * All
   * Service
   * Product Support
   * General Support
   */

  const currentType = current.searchParams.get("type");

  if (currentType) {
    target.searchParams.set("type", currentType);
  }

  /*
   * Most important:
   *
   * Keep the SAME conversation open after switching tabs.
   */

  target.searchParams.set("conversation", conversationId);

  return target.pathname + target.search;
}

function isProgressWorkflow(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const status = value.trim().toLowerCase();

  /*
   * Explicitly NOT an active-work state.
   */

  if (
    !status ||
    status === "new" ||
    // A paid package chat stays in New until staff reply to it.
    status === "paid" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "closed" ||
    status === "refunded"
  ) {
    return false;
  }

  /*
   * Everything else represents work that has progressed
   * beyond NEW:
   *
   * discussing
   * assigned
   * in_progress
   * payment_pending
   * waiting_customer
   * etc.
   */

  return true;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AdminChatQueueSync() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Prevent several focus events from repeatedly trying to
   * claim the same service.
   */

  const checkedConversationIdsRef = useRef(new Set<string>());

  const claimRunningRef = useRef(new Set<string>());

  /*
   * Prevent several realtime updates from repeatedly trying
   * to perform the same tab transition.
   */

  const navigatingConversationRef = useRef<string | null>(null);

  /* =======================================================
     SCHEDULE NORMAL SERVER REFRESH
  ======================================================= */

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;

      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  /* =======================================================
     MOVE SELECTED CHAT TO IN PROGRESS VIEW

     This uses Next.js navigation.

     It does NOT perform:
       window.location.reload()
       location.reload()
       F5

     The admin remains inside the app.
  ======================================================= */

  const moveSelectedChatToInProgress = useCallback(
    (conversationId: string) => {
      if (navigatingConversationRef.current === conversationId) {
        return;
      }

      const current = new URL(window.location.href);

      const selectedConversation = current.searchParams.get("conversation");

      /*
       * Only teleport the ADMIN if this is the conversation
       * currently being worked on.
       *
       * Another staff member changing another chat must never
       * rip this admin away from their current conversation.
       */

      if (selectedConversation !== conversationId) {
        return;
      }

      const target = getInProgressUrl(conversationId);

      if (!target) {
        /*
         * If the Owner UI is still rendering and the tab could
         * not be found, the normal realtime refresh will handle
         * the state safely.
         */

        scheduleRefresh();

        return;
      }

      const currentRelativeUrl = current.pathname + current.search;

      if (target === currentRelativeUrl) {
        return;
      }

      navigatingConversationRef.current = conversationId;

      /*
       * Cancel the pending generic refresh.
       *
       * router.replace below already causes Next.js to fetch
       * the correct server state for the new tab.
       */

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);

        refreshTimerRef.current = null;
      }

      router.replace(target, {
        scroll: false,
      });

      /*
       * Allow later workflow navigation if this conversation
       * changes state again.
       */

      window.setTimeout(() => {
        if (navigatingConversationRef.current === conversationId) {
          navigatingConversationRef.current = null;
        }
      }, 1200);
    },
    [router, scheduleRefresh],
  );

  /* =======================================================
     REALTIME QUEUE
  ======================================================= */

  useEffect(() => {
    const channel = supabase
      .channel("birdshop-admin-chat-queue")

      /* =================================================
           CONVERSATIONS
        ================================================= */

      .on(
        "postgres_changes",
        {
          event: "*",

          schema: "public",

          table: "service_conversations",
        },
        (payload) => {
          const next = payload.new as
            | {
                id?: string;

                workflow_status?: string | null;

                status?: string | null;

                deleted_at?: string | null;
              }
            | undefined;

          /*
           * INSTANT WORKFLOW NAVIGATION
           *
           * If the selected conversation moves beyond NEW,
           * jump straight to the existing In Progress tab.
           */

          if (
            next?.id &&
            next.status === "open" &&
            !next.deleted_at &&
            isProgressWorkflow(next.workflow_status)
          ) {
            moveSelectedChatToInProgress(next.id);

            return;
          }

          /*
           * Other conversation changes only need the normal
           * debounced refresh.
           */

          scheduleRefresh();
        },
      )

      /* =================================================
           PAYMENTS
        ================================================= */

      .on(
        "postgres_changes",
        {
          event: "*",

          schema: "public",

          table: "service_payment_requests",
        },
        () => {
          scheduleRefresh();
        },
      )

      /* =================================================
           ORDERS
        ================================================= */

      .on(
        "postgres_changes",
        {
          event: "*",

          schema: "public",

          table: "orders",
        },
        () => {
          scheduleRefresh();
        },
      )

      .subscribe();

    /*
     * Slow insurance only.
     *
     * Realtime is the normal update path.
     */

    const fallback = window.setInterval(() => {
      router.refresh();
    }, FALLBACK_REFRESH_MS);

    return () => {
      window.clearInterval(fallback);

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [router, supabase, moveSelectedChatToInProgress, scheduleRefresh]);

  /* =======================================================
     AUTO CLAIM FROM REPLY BOX

     OPEN CHAT:
       nothing

     READ CHAT:
       nothing

     CLICK REPLY BOX:
       claim unassigned SERVICE
       keep it NEW

     FIRST ACTUAL REPLY:
       database changes workflow away from NEW
       realtime listener above immediately moves the UI
       into IN PROGRESS
  ======================================================= */

  useEffect(() => {
    async function handleFocusIn(event: FocusEvent) {
      const target = event.target;

      if (!(target instanceof HTMLTextAreaElement)) {
        return;
      }

      if (target.dataset.adminChatComposer !== "true") {
        return;
      }

      const conversationId = target.dataset.conversationId;

      if (!conversationId) {
        return;
      }

      if (
        checkedConversationIdsRef.current.has(conversationId) ||
        claimRunningRef.current.has(conversationId)
      ) {
        return;
      }

      claimRunningRef.current.add(conversationId);

      try {
        const result = await claimConversationForCurrentStaff(conversationId);

        if (result.ok) {
          checkedConversationIdsRef.current.add(conversationId);

          if (result.claimed) {
            /*
             * This refresh only updates:
             *
             * provider name
             * provider color
             * ownership information
             *
             * The service remains NEW until somebody actually
             * replies.
             */

            router.refresh();
          }
        }
      } finally {
        claimRunningRef.current.delete(conversationId);
      }
    }

    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [router]);

  return null;
}
