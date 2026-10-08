"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowIcon } from "@/components/SiteIcons";
import { clearServiceChatToken } from "@/lib/service-chat-session";
import { MailIcon, Spinner } from "../ChatUI";
import ui from "../chat-ui.module.css";
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
      const data = await response.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." }));
      if (!response.ok) throw new Error(data.error || "Please retry in a moment.");
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
    <section className={`${ui.tokens} ${styles.page}`}>
      <div className={`${styles.shell} ${styles.shellNarrow}`}>
        <span className={styles.emptyMark} aria-hidden="true">
          <MailIcon />
        </span>
        <span className={styles.eyebrow}>My Service · Private inbox</span>
        <h1 className={styles.title}>Your conversations await.</h1>
        {token === null ? (
          <p className={styles.statusLine} role="status">
            <Spinner />
            Preparing your private inbox…
          </p>
        ) : !token ? (
          <div className={styles.notice}>
            <p>
              This link is missing or has already been opened in this tab.
              Return to My Service to continue or request a new link.
            </p>
            <Link className={styles.textLink} href="/service-chat">
              Return to My Service
              <ArrowIcon />
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
                aria-describedby="inbox-remember-hint"
              />
              <span>Remember this device for 30 days</span>
            </label>
            <p id="inbox-remember-hint" className={styles.hint}>
              Leave this unchecked on a shared device. Without it, access lasts
              up to 12 hours and uses a browser-session cookie.
            </p>
            <div className={styles.verifyActions}>
              <button
                type="button"
                className={styles.primary}
                disabled={busy}
                onClick={verify}
              >
                {busy ? "Opening your inbox…" : "Continue to My Inbox"}
                {!busy && <ArrowIcon />}
              </button>
              <Link className={styles.textLink} href="/service-chat">
                Use Another Email
              </Link>
            </div>
          </>
        )}
        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>{" "}
            <Link className={styles.textLink} href="/service-chat">
              Request a New Link
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
