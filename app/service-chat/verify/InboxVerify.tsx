"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearServiceChatToken } from "@/lib/service-chat-session";
import styles from "../CustomerInbox.module.css";
export default function InboxVerify() {
  const router = useRouter();
  const captured = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (captured.current === null) {
      captured.current =
        new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
    }
    const timer = window.setTimeout(() => setToken(captured.current), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function verify() {
    if (busy || !token) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/customer-inbox/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, remember }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      clearServiceChatToken();
      router.replace("/service-chat");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to verify this link.",
      );
      setBusy(false);
    }
  }
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <span className={styles.eyebrow}>BIRDSHOP / PRIVATE INBOX</span>
        <h1>Your conversations await.</h1>
        {token === null ? (
          <p role="status">Preparing your private inbox…</p>
        ) : !token ? (
          <div className={styles.notice}>
            <p>
              This link is missing or has already been opened in this tab.
              Return to Service Chat to continue or request a new email.
            </p>
            <Link className={styles.textLink} href="/service-chat">
              Return to Service Chat →
            </Link>
          </div>
        ) : (
          <>
            <p className={styles.intro}>
              Continue to verify the email that received this link and view its
              BirdShop conversations.
            </p>
            <label className={styles.remember}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember this device for 30 days
            </label>
            <p className={styles.hint}>
              Leave this unchecked on a shared device. Without it, access lasts
              up to 12 hours and uses a browser-session cookie.
            </p>
            <div className={styles.verifyActions}>
              <button
                className={styles.primary}
                disabled={busy}
                onClick={verify}
              >
                {busy ? "Opening your inbox…" : "Continue to my inbox"}
              </button>
              <Link className={styles.textLink} href="/service-chat">
                Use another email
              </Link>
            </div>
          </>
        )}
        {error && (
          <div className={styles.error} role="alert">
            {error} <Link href="/service-chat">Request a new link</Link>
          </div>
        )}
      </div>
    </section>
  );
}
