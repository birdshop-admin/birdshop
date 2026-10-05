"use client";

import { useEffect, useMemo, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

import { playAdminChatChime, unlockChatSound } from "@/lib/chat-sound";

/* =========================================================
   SETTINGS
========================================================= */

const STORAGE_KEY = "birdshop-admin-last-customer-message";

const FALLBACK_MS = 30_000;

/* =========================================================
   COMPONENT
========================================================= */

export default function AdminGlobalChatNotifier() {
  const supabase = useMemo(() => createClient(), []);

  const pendingSoundRef = useRef(false);

  const checkingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    /* =====================================================
       AUDIO
    ===================================================== */

    async function unlock() {
      try {
        await unlockChatSound();

        if (pendingSoundRef.current) {
          const played = playAdminChatChime();

          if (played) {
            pendingSoundRef.current = false;
          }
        }
      } catch {
        // Browser can retry.
      }
    }

    function notify(messageId: string) {
      if (!messageId) {
        return;
      }

      const previous = window.localStorage.getItem(STORAGE_KEY);

      if (previous === messageId) {
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, messageId);

      const played = playAdminChatChime();

      if (!played) {
        pendingSoundRef.current = true;
      }
    }

    /* =====================================================
       FALLBACK DIRECT QUERY
    ===================================================== */

    async function checkLatest() {
      if (
        cancelled ||
        document.visibilityState !== "visible" ||
        checkingRef.current
      ) {
        return;
      }

      checkingRef.current = true;

      try {
        const { data, error } = await supabase
          .from("service_messages")
          .select("id")
          .eq("sender_type", "customer")
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (error || !data?.id) {
          return;
        }

        const id = String(data.id);

        const existing = window.localStorage.getItem(STORAGE_KEY);

        /*
         * Establish baseline when Admin first loads.
         */

        if (!existing) {
          window.localStorage.setItem(STORAGE_KEY, id);

          return;
        }

        notify(id);
      } finally {
        checkingRef.current = false;
      }
    }

    /* =====================================================
       REALTIME
    ===================================================== */

    const channel = supabase
      .channel("birdshop-admin-global-messages-v2")
      .on(
        "postgres_changes",
        {
          event: "INSERT",

          schema: "public",

          table: "service_messages",
        },
        (payload) => {
          const row = payload.new as {
            id?: string;

            sender_type?: string;
          };

          if (row.sender_type !== "customer") {
            return;
          }

          notify(String(row.id ?? ""));
        },
      )
      .subscribe();

    /* =====================================================
       EVENTS
    ===================================================== */

    window.addEventListener("pointerdown", unlock);

    window.addEventListener("keydown", unlock);

    /*
     * Establish current state.
     */

    void checkLatest();

    /*
     * 1-second backup.
     */

    const interval = window.setInterval(() => {
      void checkLatest();
    }, FALLBACK_MS);

    function handleFocus() {
      void checkLatest();
    }

    window.addEventListener("focus", handleFocus);

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      cancelled = true;

      window.clearInterval(interval);

      window.removeEventListener("pointerdown", unlock);

      window.removeEventListener("keydown", unlock);

      window.removeEventListener("focus", handleFocus);

      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  return null;
}
