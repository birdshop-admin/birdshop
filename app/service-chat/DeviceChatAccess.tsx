"use client";
import { useEffect, useState } from "react";
import styles from "./CustomerInbox.module.css";
export default function DeviceChatAccess({
  conversationId,
  token,
}: {
  conversationId: string;
  token: string;
}) {
  const [saved, setSaved] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/customer-device?conversationId=${encodeURIComponent(conversationId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) throw new Error("Saved access could not be checked.");
        if (!controller.signal.aborted) setSaved(data.remembered === true);
      } catch {
        if (!controller.signal.aborted) {
          setSaved(false);
          setError(
            "We couldn’t check saved access. Keep your private link until this chat is remembered.",
          );
        }
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [conversationId]);
  async function change() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        saved
          ? `/api/customer-device?conversationId=${encodeURIComponent(conversationId)}`
          : "/api/customer-device",
        saved
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "remember", token }),
            },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to update saved access.");
      setSaved(!saved);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to update saved access.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className={styles.deviceNotice}>
      <div>
        <strong>
          {saved === null
            ? "Checking saved access…"
            : saved
              ? "Saved on this device"
              : "Want to come back without email?"}
        </strong>
        <p>
          {saved
            ? "Return through Service Chat. Saved access lasts up to 30 days after remembering."
            : "Remember this conversation on a device you trust. No email verification needed for this chat."}
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
      {saved !== null && (
        <button
          className={styles.secondary}
          type="button"
          disabled={busy}
          onClick={change}
        >
          {busy
            ? "Updating…"
            : saved
              ? "Forget this chat"
              : "Remember this chat"}
        </button>
      )}
    </aside>
  );
}
