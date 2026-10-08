"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCart } from "@/app/cart-context";

import styles from "@/app/cart/cart.module.css";
import CheckoutConsent from "./CheckoutConsent";
import recovery from "./ProductCheckout.module.css";
import TurnstileWidget from "./TurnstileWidget";

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
// Matches MAX_UNITS_PER_CHECKOUT in app/api/checkout/route.ts.
const MAX_UNITS = 10;
const CART_KEY = "birdshop-checkout-cart";
// Optional Cloudflare Turnstile; the server enforces it only when both keys are set.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Could not check your checkout.");
  }

  return data;
}

export default function ProductCheckout() {
  const { items, clearCart, refreshProducts } = useCart();

  const overLimit =
    items.reduce((sum, item) => sum + item.quantity, 0) > MAX_UNITS;

  const [saved, setSaved] = useState<Saved | null>(null);
  const [state, setState] = useState<CheckoutState | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [humanToken, setHumanToken] = useState<string | null>(null);
  const [humanReset, setHumanReset] = useState(0);
  const [humanUnavailable, setHumanUnavailable] = useState(false);

  const lock = useRef(false);
  const needsHuman = Boolean(TURNSTILE_SITE_KEY) && !humanToken;

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
            "Could not restore checkout. Refresh or use Check Status below.",
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

  // Returning from Stripe with Back can restore this page from the back-forward
  // cache while it was still "redirecting"; re-enable the controls.
  useEffect(() => {
    function restored(event: PageTransitionEvent) {
      if (!event.persisted) return;
      lock.current = false;
      setBusy(false);
    }

    window.addEventListener("pageshow", restored);

    return () => window.removeEventListener("pageshow", restored);
  }, []);

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

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (data.resetAttempt) {
            sessionStorage.removeItem(KEY);
            sessionStorage.removeItem(CART_KEY);
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

  // An attempt the server never confirmed (e.g. a lost response) can be abandoned;
  // any reservation it made is released automatically when it expires.
  function startOver() {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(CART_KEY);
    setSaved(null);
    setState(null);
    setError("");
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

    if (!ready || saved || lock.current || !items.length || overLimit) return;

    if (needsHuman) {
      setError("Complete the security check, then check out.");
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");
    let redirecting = false;

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
          turnstileToken: humanToken ?? undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Nothing was reserved: return the customer to the form with the reason.
        if (data.resetAttempt) {
          sessionStorage.removeItem(KEY);
          sessionStorage.removeItem(CART_KEY);
          setSaved(null);
        }

        throw new Error(data.error || "Could not start checkout.");
      }

      if (typeof data.returnToken !== "string" || !data.url) {
        throw new Error("Please recover your checkout below.");
      }

      save({ ...attempt, token: data.returnToken });

      // Stay busy while the browser leaves for Stripe.
      redirecting = true;
      window.location.assign(data.url);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not start checkout.",
      );
    } finally {
      if (!redirecting) {
        lock.current = false;
        setBusy(false);
        // Security-check tokens are single-use; get a fresh one for the next try.
        if (TURNSTILE_SITE_KEY) setHumanReset((count) => count + 1);
      }
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
                {new Date(state.expiresAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
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
              View Private Order
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
                    ? "Resume Checkout"
                    : "Recover Checkout"}
                </button>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => void act("check")}
              >
                Check Status
              </button>

              {saved.token ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("cancel")}
                >
                  Cancel Checkout
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={startOver}>
                  Start Over
                </button>
              )}
            </>
          )}

          {(paid || ended) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void dismiss()}
            >
              Return to Cart
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

      {overLimit && (
        <p role="alert" className={styles.checkoutError}>
          Checkout supports up to {MAX_UNITS} codes per order. Reduce
          quantities to continue.
        </p>
      )}

      {TURNSTILE_SITE_KEY && (
        <>
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            action="checkout"
            resetKey={humanReset}
            onToken={(token) => {
              setHumanToken(token);
              if (token) setHumanUnavailable(false);
            }}
            onUnavailable={() => setHumanUnavailable(true)}
          />

          {humanUnavailable && (
            <p role="alert" className={styles.checkoutError}>
              The security check could not load. Refresh the page, or allow
              challenges.cloudflare.com if a content blocker is on.
            </p>
          )}
        </>
      )}

      <button
        className={styles.checkoutButton}
        disabled={busy || overLimit || needsHuman}
      >
        {busy ? "Preparing secure checkout…" : "Check Out Securely"}
      </button>

      <p className={styles.checkoutNote}>
        Stock and prices are checked before payment. Your items are held for
        about 30 minutes while you pay, and your private delivery link arrives
        by email after payment is confirmed.
      </p>

      <CheckoutConsent className={styles.checkoutNote} />

      {error && (
        <p role="alert" className={styles.checkoutError}>
          {error}
        </p>
      )}
    </form>
  );
}