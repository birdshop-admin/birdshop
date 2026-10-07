"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCart } from "@/app/cart-context";

import styles from "@/app/cart/cart.module.css";
import recovery from "./ProductCheckout.module.css";

type Saved = {
  id: string;
  fingerprint: string;
  token?: string;
};

type CheckoutState = {
  status: string;
  cancelling: boolean;
  orderToken: string | null;
  expiresAt: string;
  items: { name: string; quantity: number }[];
  total: number;
  currency: string;
  url: string | null;
};

const KEY = "birdshop-checkout-attempt";
const CART_KEY = "birdshop-checkout-cart";

const closed = (status: string) =>
  ["expired", "cancelled", "failed"].includes(status);

async function manage(
  token: string,
  action: string,
): Promise<CheckoutState> {
  const response = await fetch("/api/checkout/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action }),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not check your checkout.");
  }

  return data;
}

export default function ProductCheckout() {
  const { items, clearCart, refreshProducts } = useCart();

  const [saved, setSaved] = useState<Saved | null>(null);
  const [state, setState] = useState<CheckoutState | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const value = JSON.parse(
          sessionStorage.getItem(KEY) || "null",
        );

        if (
          value &&
          typeof value.id === "string" &&
          typeof value.fingerprint === "string"
        ) {
          if (!active) return;

          setSaved(value);

          if (value.token) {
            const result = await manage(value.token, "check");

            if (active) {
              setState(result);

              if (closed(result.status)) {
                await refreshProducts();
              }
            }
          }
        }
      } catch {
        if (active) {
          setError(
            "Could not restore checkout. Refresh or use Check status below.",
          );
        }
      } finally {
        if (active) setReady(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [refreshProducts]);

  function save(value: Saved) {
    sessionStorage.setItem(KEY, JSON.stringify(value));
    setSaved(value);
  }

  async function act(action: "check" | "resume" | "cancel") {
    if (!saved || lock.current) return;

    lock.current = true;
    setBusy(true);
    setError("");

    try {
      let token = saved.token;

      if (!token) {
        // Recover attempts saved by the previous checkout component.
        const original = JSON.parse(saved.fingerprint);

        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: saved.id,
            items: original.items,
            email: original.email,
            name,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.resetAttempt) {
            sessionStorage.removeItem(KEY);
            setSaved(null);
            setState(null);
            await refreshProducts();
          }

          throw new Error(data.error || "Could not recover checkout.");
        }

        if (typeof data.returnToken !== "string") {
          throw new Error("Checkout recovery is unavailable.");
        }

        token = data.returnToken;
        save({ ...saved, token });
      }

      const result = await manage(token!, action);
      setState(result);

      if (closed(result.status)) {
        await refreshProducts();
      }

      if (action === "resume" && result.url) {
        window.location.assign(result.url);
      }
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Please retry shortly.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function dismiss() {
    if (
      !state ||
      (!closed(state.status) && !state.orderToken)
    ) {
      return;
    }

    try {
      if (
        state.orderToken &&
        sessionStorage.getItem(CART_KEY) === JSON.stringify(items)
      ) {
        clearCart();
      }

      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(CART_KEY);

      setSaved(null);
      setState(null);
      setError("");

      await refreshProducts();
    } catch {
      setError(
        "Could not update this browser’s saved checkout. Please refresh.",
      );
    }
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();

    if (!ready || saved || lock.current || !items.length) return;

    lock.current = true;
    setBusy(true);
    setError("");

    try {
      const attempt: Saved = {
        id: crypto.randomUUID(),
        fingerprint: JSON.stringify({
          items,
          email: email.trim().toLowerCase(),
        }),
      };

      // Save recovery information before reserving stock.
      sessionStorage.setItem(CART_KEY, JSON.stringify(items));
      save(attempt);

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          items,
          email,
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.resetAttempt) {
          sessionStorage.removeItem(KEY);
          setSaved(null);
        }

        throw new Error(data.error || "Could not start checkout.");
      }

      if (typeof data.returnToken !== "string" || !data.url) {
        throw new Error("Please recover your checkout below.");
      }

      save({ ...attempt, token: data.returnToken });

      window.location.assign(data.url);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not start checkout.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <p className={styles.checkoutNote}>
        Checking saved checkout…
      </p>
    );
  }

  if (saved) {
    const paid = Boolean(state?.orderToken);
    const ended = Boolean(state && closed(state.status));

    const resumable =
      !state ||
      (!state.cancelling &&
        ["creating", "open"].includes(state.status));

    return (
      <section className={recovery.card} aria-busy={busy}>
        <span className={recovery.eyebrow}>YOUR CHECKOUT</span>

        <h3>
          {paid
            ? "Your order is ready"
            : ended
              ? "Checkout closed"
              : "Pick up where you left off"}
        </h3>

        <p>
          {paid
            ? "Payment confirmed. Open your private order for delivery updates."
            : ended
              ? "This checkout is closed. You can return to your cart."
              : state?.cancelling
                ? "Cancellation is being confirmed. Check status again shortly."
                : state?.status === "processing"
                  ? "Your payment is being confirmed. Please do not pay again."
                  : "Resume your saved checkout, or cancel it to release its reserved items. Cart changes do not change this saved checkout."}
        </p>

        {state && (
          <>
            <ul>
              {state.items.map((item, index) => (
                <li key={index}>
                  <span>{item.name}</span>
                  <strong>× {item.quantity}</strong>
                </li>
              ))}
            </ul>

            <p className={recovery.total}>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: state.currency,
              }).format(state.total)}
            </p>

            {!ended && !paid && (
              <p>
                Reserved until{" "}
                {new Date(state.expiresAt).toLocaleString()}
                {" "}unless payment is processing.
              </p>
            )}
          </>
        )}

        <div className={recovery.actions}>
          {paid && (
            <Link
              href={`/orders/access?token=${encodeURIComponent(
                state!.orderToken!,
              )}`}
            >
              View private order
            </Link>
          )}

          {!paid && !ended && (
            <>
              {resumable && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(saved.token ? "resume" : "check")
                  }
                >
                  {saved.token
                    ? "Resume checkout"
                    : "Recover checkout"}
                </button>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => void act("check")}
              >
                Check status
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void act("cancel")}
              >
                Cancel checkout
              </button>
            </>
          )}

          {(paid || ended) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void dismiss()}
            >
              Return to cart
            </button>
          )}
        </div>

        {busy && <p role="status">Checking your checkout…</p>}

        {error && (
          <p role="alert" className={styles.checkoutError}>
            {error}
          </p>
        )}
      </section>
    );
  }

  if (!items.length) {
    return error ? (
      <p role="alert" className={styles.checkoutError}>
        {error}
      </p>
    ) : null;
  }

  return (
    <form onSubmit={checkout} className={styles.checkoutForm}>
      <label>
        Your name
        <input
          autoComplete="name"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
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
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <button className={styles.checkoutButton} disabled={busy}>
        {busy ? "Preparing secure checkout…" : "Checkout securely"}
      </button>

      <p className={styles.checkoutNote}>
        Stock and prices are checked before payment. Your private delivery
        link arrives by email after payment is confirmed.
      </p>

      {error && (
        <p role="alert" className={styles.checkoutError}>
          {error}
        </p>
      )}
    </form>
  );
}