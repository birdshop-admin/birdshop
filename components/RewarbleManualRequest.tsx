"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useCart } from "@/app/cart-context";
import TurnstileWidget from "@/components/TurnstileWidget";
import styles from "./RewarbleManualRequest.module.css";

const ENABLED = process.env.NEXT_PUBLIC_REWARBLE_MANUAL_ENABLED === "true";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function RewarbleManualRequest() {
  const { items } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [claimedValue, setClaimedValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusUrl, setStatusUrl] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [tokenReset, setTokenReset] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ENABLED || busy || statusUrl) return;
    if (!/^\d{16}$/.test(code.replace(/[ -]/g, ""))) {
      setError("Enter your 16-digit Rewarble voucher code.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !token) {
      setError("Complete the security check first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payment-requests/rewarble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name, email, code, claimedValue: Number(claimedValue), items,
          turnstileToken: token ?? undefined,
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string; statusUrl?: string;
      };
      if (!response.ok || !result.statusUrl)
        throw new Error(result.error || "Voucher request was not accepted.");
      setCode("");
      setStatusUrl(result.statusUrl);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Submission unavailable.");
    } finally {
      setBusy(false);
      setToken(null);
      setTokenReset(value => value + 1);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="manual-voucher-heading">
      <p className={styles.eyebrow}>OPTIONAL / MANUAL REVIEW</p>
      <h4 id="manual-voucher-heading">Pay with a Rewarble voucher</h4>
      <p className={styles.disclaimer}>
        Have an unused 16-digit Rewarble voucher? Request an owner-reviewed payment
        arrangement. Submitting a code does not pay for an order, reserve stock,
        or trigger digital delivery. Only submit a code you own and intend to transfer.
      </p>
      {!ENABLED ? (
        <p role="status" className={styles.notice}>
          Secure voucher submissions are being set up. For now, use Stripe or{" "}
          <Link href="/contact?topic=rewarble-payment">contact support</Link>.
          Do not send voucher codes in ordinary chat.
        </p>
      ) : statusUrl ? (
        <div role="status" className={styles.confirmation}>
          <strong>Request submitted for review.</strong>
          <p>Save the private tracking link. Your voucher has not been confirmed as payment.</p>
          <Link href={statusUrl} rel="nofollow">View your review status</Link>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} autoComplete="off">
          <label>
            Your name
            <input type="text" maxLength={120} value={name}
              onChange={event => setName(event.target.value)} required />
          </label>
          <label>
            Contact email
            <input type="email" maxLength={320} value={email}
              onChange={event => setEmail(event.target.value)} required />
          </label>
          <label>
            Voucher face value (USD)
            <input type="number" min="0.50" max="999999.99" step="0.01"
              value={claimedValue} onChange={event => setClaimedValue(event.target.value)}
              required placeholder="25.00" />
          </label>
          <label>
            Unused Rewarble voucher code
            <input type="password" inputMode="numeric" maxLength={30}
              autoComplete="off" spellCheck={false} value={code}
              onChange={event => setCode(event.target.value)}
              required placeholder="16-digit code" />
          </label>
          {TURNSTILE_SITE_KEY && (
            <TurnstileWidget siteKey={TURNSTILE_SITE_KEY}
              action="rewarble" resetKey={tokenReset}
              onToken={setToken} />
          )}
          <button type="submit" disabled={busy || !items.length || Boolean(TURNSTILE_SITE_KEY && !token)}>
            {busy ? "Submitting securely…" : "Submit for manual review"}
          </button>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </form>
      )}
    </section>
  );
}
