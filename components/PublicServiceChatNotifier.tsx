"use client";

import {
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  usePathname,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  playChatChime,
  unlockChatSound,
} from "@/lib/chat-sound";

import {
  readServiceChatToken,
  SERVICE_CHAT_BROADCAST_EVENT,
  SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY,
  SERVICE_CHAT_LIVE_EVENT,
  SERVICE_CHAT_TOKEN_EVENT,
  serviceChatChannelName,
} from "@/lib/service-chat-session";

/* =========================================================
   TYPES
========================================================= */

type NotificationMessage = {
  id: string;

  sender_type:
    | "customer"
    | "admin"
    | "system";

  created_at: string;
};

type ChatResponse = {
  messages?:
    NotificationMessage[];
};

/* =========================================================
   FALLBACK

   Realtime is the normal notification path.

   This direct protected-chat check runs once per second only
   as insurance if the websocket misses an event.
========================================================= */

const FALLBACK_POLL_MS =
  1000;

/* =========================================================
   PUBLIC BIRDSHOP SERVICE NOTIFIER
========================================================= */

export default function PublicServiceChatNotifier() {
  const pathname =
    usePathname();

  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const pathnameRef =
    useRef(
      pathname
    );

  const pendingSoundRef =
    useRef(false);

  const checkingRef =
    useRef(false);

  const monitoredTokenRef =
    useRef<
      string | null
    >(null);

  /* =======================================================
     CURRENT PAGE
  ======================================================= */

  useEffect(() => {
    pathnameRef.current =
      pathname;
  }, [
    pathname,
  ]);

  /* =======================================================
     NOTIFICATION SYSTEM
  ======================================================= */

  useEffect(() => {
    let cancelled =
      false;

    let realtimeChannel:
      ReturnType<
        typeof supabase.channel
      >
      | null =
      null;

    /* =====================================================
       AUDIO
    ===================================================== */

    async function unlock() {
      try {
        await unlockChatSound();

        if (
          pendingSoundRef.current &&
          !pathnameRef.current.startsWith(
            "/service-chat"
          )
        ) {
          const played =
            playChatChime();

          if (played) {
            pendingSoundRef.current =
              false;
          }
        }
      } catch {
        /*
         * Browser can try again after another interaction.
         */
      }
    }

    /* =====================================================
       NOTIFY CUSTOMER
    ===================================================== */

    function deliverNotification() {
      /*
       * When actually looking at the private Service Chat,
       * wake ServiceChatClient instead of creating a second
       * global notification sound.
       */

      if (
        pathnameRef.current.startsWith(
          "/service-chat"
        )
      ) {
        window.dispatchEvent(
          new CustomEvent(
            SERVICE_CHAT_LIVE_EVENT
          )
        );

        return;
      }

      /*
       * Customer is elsewhere on BirdShop.
       */

      const played =
        playChatChime();

      if (!played) {
        pendingSoundRef.current =
          true;
      }
    }

    /* =====================================================
       SECURE CHAT CHECK
    ===================================================== */

    async function checkChat(
      source:
        | "baseline"
        | "live"
        | "fallback"
    ) {
      if (
        cancelled ||
        checkingRef.current
      ) {
        return;
      }

      const token =
        readServiceChatToken();

      if (!token) {
        return;
      }

      if (
        monitoredTokenRef.current !==
        token
      ) {
        monitoredTokenRef.current =
          token;

        window.sessionStorage.removeItem(
          SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY
        );
      }

      checkingRef.current =
        true;

      try {
        const response =
          await fetch(
            `/api/service-chat/${encodeURIComponent(
              token
            )}`,
            {
              cache:
                "no-store",
            }
          );

        if (
          !response.ok
        ) {
          return;
        }

        const result =
          await response.json() as ChatResponse;

        const messages =
          Array.isArray(
            result.messages
          )
            ? result.messages
            : [];

        /*
         * We only care about messages coming TO the customer.
         */

        const latestIncoming =
          [...messages]
            .reverse()
            .find(
              (
                item
              ) =>
                item.sender_type ===
                  "admin" ||
                item.sender_type ===
                  "system"
            );

        if (
          !latestIncoming
        ) {
          return;
        }

        const previousId =
          window.sessionStorage.getItem(
            SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY
          );

        /* =================================================
           FIRST LOAD
        ================================================= */

        if (!previousId) {
          window.sessionStorage.setItem(
            SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY,
            latestIncoming.id
          );

          /*
           * A live Broadcast represents a new event, so it
           * may notify even if there was no previous stored
           * message ID.
           */

          if (
            source ===
            "live"
          ) {
            deliverNotification();
          }

          return;
        }

        /* =================================================
           SAME MESSAGE
        ================================================= */

        if (
          previousId ===
          latestIncoming.id
        ) {
          return;
        }

        /* =================================================
           NEW MESSAGE
        ================================================= */

        window.sessionStorage.setItem(
          SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY,
          latestIncoming.id
        );

        deliverNotification();
      } catch {
        /*
         * Never allow notification failure to break shop UI.
         */
      } finally {
        checkingRef.current =
          false;
      }
    }

    /* =====================================================
       SUBSCRIBE TO CUSTOMER'S PRIVATE REALTIME CHANNEL
    ===================================================== */

    function subscribeToCurrentChat() {
      const token =
        readServiceChatToken();

      if (
        realtimeChannel
      ) {
        void supabase.removeChannel(
          realtimeChannel
        );

        realtimeChannel =
          null;
      }

      if (!token) {
        return;
      }

      realtimeChannel =
        supabase
          .channel(
            serviceChatChannelName(
              token
            )
          )
          .on(
            "broadcast",
            {
              event:
                SERVICE_CHAT_BROADCAST_EVENT,
            },
            () => {
              /*
               * If the customer is actively looking at their
               * Service Chat, wake that page immediately.
               *
               * This avoids doing one notifier fetch and THEN
               * a second ServiceChatClient fetch.
               */

              if (
                pathnameRef.current.startsWith(
                  "/service-chat"
                )
              ) {
                window.dispatchEvent(
                  new CustomEvent(
                    SERVICE_CHAT_LIVE_EVENT
                  )
                );

                return;
              }

              /*
               * Elsewhere on BirdShop, securely verify the
               * private chat and then play the notification.
               */

              void checkChat(
                "live"
              );
            }
          )
          .subscribe();
    }

    /* =====================================================
       CUSTOMER OPENED A CHAT
    ===================================================== */

    function handleTokenChange() {
      subscribeToCurrentChat();

      void checkChat(
        "baseline"
      );
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    window.addEventListener(
      "pointerdown",
      unlock
    );

    window.addEventListener(
      "keydown",
      unlock
    );

    window.addEventListener(
      SERVICE_CHAT_TOKEN_EVENT,
      handleTokenChange
    );

    subscribeToCurrentChat();

    void checkChat(
      "baseline"
    );

    /* =====================================================
       SAFETY CHECK
    ===================================================== */

    const fallbackInterval =
      window.setInterval(
        () => {
          void checkChat(
            "fallback"
          );
        },
        FALLBACK_POLL_MS
      );

    function handleFocus() {
      void checkChat(
        "fallback"
      );
    }

    function handleVisibility() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void checkChat(
          "fallback"
        );
      }
    }

    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      cancelled =
        true;

      window.clearInterval(
        fallbackInterval
      );

      window.removeEventListener(
        "pointerdown",
        unlock
      );

      window.removeEventListener(
        "keydown",
        unlock
      );

      window.removeEventListener(
        SERVICE_CHAT_TOKEN_EVENT,
        handleTokenChange
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      if (
        realtimeChannel
      ) {
        void supabase.removeChannel(
          realtimeChannel
        );
      }
    };
  }, [
    supabase,
  ]);

  return null;
}