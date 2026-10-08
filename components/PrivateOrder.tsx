"use client";

import { startVisiblePoll } from "@/lib/visible-poll";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "@/app/cart-context";
import styles from "./PrivateOrder.module.css";

type Delivery = {
  order: {
    reference: string;
    total: number;
    currency: string;
    payment_status: string;
    refunded_amount: number;
    fulfillment_status: string;
    delivery_status: string;
  };
  items: {
    quantity: number;
    product_name: string;
    platform: string;
    region: string;
  }[];
};

export function CheckoutReturn() {
  const query = useSearchParams();
  const router = useRouter();
  const token = query.get("token") ?? "";

  const { clearCart } = useCart();
  const [status, setStatus] = useState("Checking your payment…");

  useEffect(() => {
    if (!token) return;

    let polls = 0;

    return startVisiblePoll(async (signal) => {
      try {
        polls += 1;

        // Usually the webhook confirms first. Every fifth check asks the server to
        // verify directly with Stripe, so a delayed webhook cannot stall this page.
        const response =
          polls % 5 === 0
            ? await fetch("/api/checkout/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, action: "check" }),
                cache: "no-store",
                signal,
              })
            : await fetch(
                `/api/checkout/status?token=${encodeURIComponent(token)}`,
                { cache: "no-store", signal },
              );

        const data = await response.json().catch(() => ({}));

        if (response.status === 404) {
          setStatus(
            "This checkout link is invalid or no longer available. Return to your cart or contact BirdShop.",
          );
          return false;
        }

        if (!response.ok)
          throw new Error(
            data.error || "Payment confirmation is temporarily unavailable.",
          );
        if (signal.aborted) return false;

        if (data.orderToken) {
          try {
            // Clear the cart only if it still holds exactly what was purchased.
            if (
              sessionStorage.getItem("birdshop-checkout-cart") ===
              localStorage.getItem("birdshop-cart")
            ) {
              clearCart();
            }

            sessionStorage.removeItem("birdshop-checkout-attempt");
            sessionStorage.removeItem("birdshop-checkout-cart");
          } catch {
            // Delivery does not depend on cart storage.
          }

          router.replace(
            `/orders/access?token=${encodeURIComponent(data.orderToken)}`,
          );

          return false;
        }

        if (["expired", "failed", "cancelled"].includes(data.status)) {
          setStatus(
            "This checkout did not complete. Your cart is available below.",
          );

          return false;
        }

        setStatus(
          query.get("payment") === "cancelled"
            ? "You returned from checkout. No completed payment has been recorded yet. Your cart is still available."
            : "Waiting for verified payment confirmation. We will email your private delivery link as soon as it is ready.",
        );
      } catch (problem) {
        if (!signal.aborted) {
          setStatus(
            problem instanceof Error
              ? problem.message
              : "Payment confirmation is temporarily unavailable.",
          );
        }
      }
    }, 4000);
  }, [token, router, query, clearCart]);

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>BIRDSHOP / CHECKOUT</span>

        <h1 className={styles.title}>One final step.</h1>

        <p className={styles.intro}>
          Your purchase is being checked securely.
        </p>

        <div className={styles.card}>
          <span className={styles.badge}>CHECKOUT STATUS</span>

          <h2>Your order, taken care of.</h2>

          <p role="status">
            {token
              ? status
              : "This checkout link is incomplete. Return to your cart or contact BirdShop."}
          </p>

          <div className={styles.actions}>
            <Link className={styles.primary} href="/cart">
              Return to cart
              <span aria-hidden="true">↗</span>
            </Link>

            <Link
              className={styles.secondary}
              href="/contact?topic=product"
            >
              Product support
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function OrderAccess() {
  const token = useSearchParams().get("token") ?? "";

  return <OrderDetails key={token} token={token} />;
}

function OrderDetails({ token }: { token: string }) {
  const [data, setData] = useState<Delivery | null>(null);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(!/^[a-f0-9]{64}$/.test(token));

  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) return;

    return startVisiblePoll(async (signal) => {
      try {
        const response = await fetch(
          `/api/orders/access?token=${encodeURIComponent(token)}`,
          { cache: "no-store", signal },
        );

        // A wrong or removed link will not start working by retrying.
        if (response.status === 404) {
          setInvalid(true);
          return false;
        }

        const result = await response.json();

        if (!response.ok) throw new Error("Order status unavailable.");
        if (signal.aborted) return false;

        setData(result as Delivery);
        setError("");

        return !["sent", "cancelled"].includes(
          result.order.delivery_status,
        );
      } catch {
        if (!signal.aborted) {
          setError(
            "Order status could not refresh. We will retry automatically.",
          );
        }
      }
    }, 10000);
  }, [token]);

  const order = data?.order;
  const sent = order?.delivery_status === "sent";
  const stopped = order?.delivery_status === "cancelled";

  const needsHelp = ["failed", "attention"].includes(
    order?.delivery_status ?? "",
  );

  const money = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: order?.currency || "USD",
    }).format(Number(value));

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <header className={styles.heading}>
          <span className={styles.eyebrow}>BIRDSHOP / YOUR ORDER</span>

          <h1 className={styles.title}>
            {data
              ? "Thank you for choosing BirdShop."
              : "Your order, all in one place."}
          </h1>

          <p className={styles.intro}>
            Your purchase details and delivery updates, kept together.
          </p>
        </header>

        {error && (
          <p className={styles.notice} role="alert">
            {error}
          </p>
        )}

        {!data && (
          <div className={styles.card}>
            <p role="status">
              {invalid
                ? "This order link is invalid or no longer available. Use the link in your BirdShop email, or contact Product Support with your order reference."
                : error
                  ? "Your order details will appear when the connection returns."
                  : "Opening your private order…"}
            </p>
            {invalid && (
              <div className={styles.actions}>
                <Link
                  className={styles.secondary}
                  href="/contact?topic=product"
                >
                  Product support
                </Link>
              </div>
            )}
          </div>
        )}

        {data && order && (
          <div className={styles.layout}>
            <article className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.eyebrow}>
                    ORDER REFERENCE
                  </span>

                  <h2>{order.reference}</h2>
                </div>

                <span className={styles.badge}>
                  {order.payment_status.replaceAll("_", " ")}
                </span>
              </div>

              <div className={styles.items}>
                {data.items.map((item, index) => (
                  <div
                    className={styles.item}
                    key={`${index}-${item.product_name}`}
                  >
                    <span className={styles.itemIcon} aria-hidden="true">
                      ↗
                    </span>

                    <div>
                      <h3>{item.product_name}</h3>

                      <p>
                        {[item.platform, item.region]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <span className={styles.quantity}>
                      Qty {item.quantity}
                    </span>
                  </div>
                ))}
              </div>

              <dl className={styles.totals}>
                <div>
                  <dt>Order total</dt>
                  <dd>{money(order.total)}</dd>
                </div>

                {Number(order.refunded_amount) > 0 && (
                  <div>
                    <dt>Refunded</dt>
                    <dd>{money(order.refunded_amount)}</dd>
                  </div>
                )}
              </dl>

              <p className={styles.footnote}>
                Keep your order reference and private link safe. They help
                us find your purchase whenever you need support.
              </p>
            </article>

            <aside className={styles.delivery}>
              <span className={styles.eyebrow}>DIGITAL DELIVERY</span>

              <div className={styles.deliveryMark} aria-hidden="true">
                {sent ? "✓" : stopped || needsHelp ? "!" : "↗"}
              </div>

              <div role="status">
                <h2>
                  {sent
                    ? "Check your inbox."
                    : stopped
                      ? "Delivery paused."
                      : needsHelp
                        ? "We’re checking your delivery."
                        : "Preparing your delivery."}
                </h2>

                <p>
                  {sent
                    ? "Your code email has been sent to our email provider for delivery. Check your inbox, and your spam folder if needed."
                    : stopped
                      ? "Code delivery was stopped following the refund. Contact us if you need help with this order."
                      : needsHelp
                        ? "Your payment is recorded. Delivery needs a check from our team—please contact support. You do not need to pay again."
                        : "Your payment is recorded. We’re preparing your codes for email delivery. This page updates automatically."}
                </p>
              </div>

              <div className={styles.deliveryNote}>
                <span aria-hidden="true">↳</span>
                <p>
                  Need help activating your product? Have your order
                  reference ready.
                </p>
              </div>

              <Link
                className={styles.support}
                href="/contact?topic=product"
              >
                Get product support
                <span aria-hidden="true">↗</span>
              </Link>
            </aside>
          </div>
        )}

        <nav
          className={styles.bottom}
          aria-label="After your purchase"
        >
          <Link className={styles.primary} href="/products">
            Continue shopping
            <span aria-hidden="true">↗</span>
          </Link>

          <Link className={styles.secondary} href="/how-to-order#products">
            How delivery works
          </Link>
        </nav>
      </div>
    </section>
  );
}