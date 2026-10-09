"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<void> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();

  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });

  return loading;
}

type Props = {
  siteKey: string;
  action: string;
  // Change this number to get a fresh token (tokens are single-use).
  resetKey: number;
  onToken: (token: string | null) => void;
  onUnavailable: () => void;
};

// Cloudflare Turnstile bot check. Rendered only when a site key is configured.
export default function TurnstileWidget({
  siteKey,
  action,
  resetKey,
  onToken,
  onUnavailable,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callbacks = useRef({ onToken, onUnavailable });

  useEffect(() => {
    callbacks.current = { onToken, onUnavailable };
  });

  useEffect(() => {
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;

        widgetId.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          action,
          // "flexible" fills the form (minimum 300px); very narrow phones get "compact".
          size: box.current.clientWidth < 300 ? "compact" : "flexible",
          theme:
            document.documentElement.dataset.theme === "dark"
              ? "dark"
              : "light",
          callback: (token: string) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(null),
          "error-callback": () => {
            callbacks.current.onToken(null);
            callbacks.current.onUnavailable();
          },
        });
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onUnavailable();
      });

    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (!resetKey || !widgetId.current) return;
    callbacks.current.onToken(null);
    window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  return (
    <div
      ref={box}
      // No reserved height: in Cloudflare's Invisible mode nothing renders here.
      style={{ maxWidth: "100%" }}
      aria-label="Security check"
    />
  );
}
