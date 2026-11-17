"use client";

import { useState, type FormEvent } from "react";
import styles from "./PostPurchaseReferral.module.css";

export default function PostPurchaseReferral({ token }: { token: string }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || confirmed) return;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,20}$/.test(normalized)) {
      setStatus("Enter a valid referral code.");
      return;
    }
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/referrals/claim", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: normalized }),
      });
      const result: { status?: string; message?: string; error?: string } =
        await response.json();
      if (!response.ok) {
        setStatus(result.error || "Referral verification is unavailable. Try again later.");
        return;
      }
      setConfirmed(true);
      setStatus(result.message || "Your referral has been recorded.");
    } catch {
      setStatus("Could not reach BirdShop. Please try again later.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="referral-after-purchase-title">
      <span className={styles.eyebrow}>BIRDSHOP / CREDIT A FRIEND</span>
      <h2 id="referral-after-purchase-title">Referred by someone?</h2>
      <p>
        If this is your first eligible BirdShop purchase, you can credit the
        friend who referred you within seven days of payment. Their $0.50
        reward is subject to fulfillment and review.
      </p>
      <form onSubmit={submit} className={styles.form}>
        <label htmlFor="postpurchase-referral-code">Friend&apos;s referral code</label>
        <div className={styles.controls}>
          <input
            id="postpurchase-referral-code"
            type="text"
            name="referralCode"
            autoComplete="off"
            maxLength={20}
            pattern="[A-Za-z0-9]{6,20}"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Enter referral code"
            disabled={pending || confirmed}
          />
          <button type="submit" disabled={pending || confirmed}>
            {confirmed ? "Verified" : pending ? "Checking…" : "Credit friend"}
          </button>
        </div>
      </form>
      {status && <p role="status" className={styles.status}>{status}</p>}
      <p className={styles.note}>
        One referrer per paying customer&apos;s first purchase. Promo codes and
        referral codes are separate; entering a referral code will not change
        your order total or issue an immediate payout.
      </p>
    </section>
  );
}
