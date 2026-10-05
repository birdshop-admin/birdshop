"use client";
import { useRef, useState, type FormEvent } from "react";
import { useCart } from "@/app/cart-context";
import styles from "@/app/cart/cart.module.css";
export default function ProductCheckout() {
  const { items } = useCart();
  const memoryAttempt = useRef<{ id: string; fingerprint: string } | null>(
    null,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify({
        items,
        email: email.trim().toLowerCase(),
      });
      let attemptId =
        memoryAttempt.current?.fingerprint === fingerprint
          ? memoryAttempt.current.id
          : crypto.randomUUID();
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("birdshop-checkout-attempt") || "null",
        );
        if (saved?.fingerprint === fingerprint && typeof saved.id === "string")
          attemptId = saved.id;
        sessionStorage.setItem(
          "birdshop-checkout-attempt",
          JSON.stringify({ id: attemptId, fingerprint }),
        );
        sessionStorage.setItem("birdshop-checkout-cart", JSON.stringify(items));
      } catch {
        /* The server still enforces payment and stock constraints. */
      }
      memoryAttempt.current = { id: attemptId, fingerprint };
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, items, email, name }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.resetAttempt) {
          memoryAttempt.current = null;
          try {
            sessionStorage.removeItem("birdshop-checkout-attempt");
          } catch {
            /* Storage may be disabled. */
          }
        }
        throw new Error(data.error);
      }
      window.location.assign(data.url);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not start checkout.",
      );
      setBusy(false);
    }
  }
  return (
    <form onSubmit={checkout} className={styles.checkoutForm}>
      <label>
        Your name
        <input
          autoComplete="name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label>
        Delivery email
        <input
          type="email"
          autoComplete="email"
          maxLength={320}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <button
        className={styles.checkoutButton}
        disabled={busy || !items.length}
      >
        {busy ? "Preparing secure checkout…" : "Checkout securely"}
      </button>
      <p className={styles.checkoutNote}>
        Stock and prices are checked before payment. Your private delivery link
        arrives by email after payment is confirmed.
      </p>
      {error && (
        <p role="alert" className={styles.checkoutError}>
          {error}
        </p>
      )}
    </form>
  );
}
