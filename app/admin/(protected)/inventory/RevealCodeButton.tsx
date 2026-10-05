"use client";

import { useEffect, useState } from "react";

import { revealInventoryCode } from "./actions";

import styles from "./inventory.module.css";

export default function RevealCodeButton({
  inventoryId,
}: {
  inventoryId: string;
}) {
  const [code, setCode] = useState<string | null>(null);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    const hide = () => {
      setCode(null);
      setCopied(false);
    };
    const timer = window.setTimeout(hide, 30000);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") hide();
    };
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code]);
  async function reveal() {
    if (code) {
      setCode(null);
      setCopied(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await revealInventoryCode(inventoryId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCode(result.code);
    } catch {
      setError("Code access could not be verified. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.revealArea}>
      <button
        type="button"
        className={styles.revealButton}
        onClick={reveal}
        disabled={loading}
      >
        {loading ? "Checking…" : code ? "Hide Code" : "Reveal Code"}
      </button>

      {code && (
        <div className={styles.revealedCode}>
          <code>{code}</code>

          <button type="button" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {error && <small className={styles.revealError}>{error}</small>}
    </div>
  );
}
