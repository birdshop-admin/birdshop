"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "@/app/cart-context";
import styles from "@/app/service-chat/service-chat.module.css";
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
  const query = useSearchParams(),
    router = useRouter();
  const token = query.get("token") ?? "";
  const { items, clearCart } = useCart();
  const [status, setStatus] = useState("Checking your payment…");
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let checks = 0;
    const check = async () => {
      try {
        const response = await fetch(
          `/api/checkout/status?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (stopped) return;
        if (data.orderToken) {
          try {
            if (
              sessionStorage.getItem("birdshop-checkout-cart") ===
              JSON.stringify(items)
            )
              clearCart();
            sessionStorage.removeItem("birdshop-checkout-attempt");
          } catch {
            /* Delivery does not depend on cart storage. */
          }
          router.replace(
            `/orders/access?token=${encodeURIComponent(data.orderToken)}`,
          );
          return;
        }
        if (["expired", "failed", "cancelled"].includes(data.status)) {
          setStatus(
            "This checkout did not complete. Your cart is available below.",
          );
          return;
        }
        setStatus(
          query.get("payment") === "cancelled"
            ? "You returned from checkout. No completed payment has been recorded yet. Your cart is still available."
            : "Waiting for verified payment confirmation. We will email your private delivery link as soon as it is ready.",
        );
      } catch (problem) {
        if (!stopped)
          setStatus(
            problem instanceof Error
              ? problem.message
              : "Payment confirmation is temporarily unavailable.",
          );
      }
      checks++;
      if (!stopped && checks < 40) timer = setTimeout(check, 4000);
    };
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token, router, query, items, clearCart]);
  return (
    <section className={styles.recovery}>
      <span className={styles.eyebrow}>BIRDSHOP CHECKOUT</span>
      <h1>Your purchase, all in one place.</h1>
      <p role="status">
        {token
          ? status
          : "This checkout link is incomplete. Return to your cart or contact BirdShop."}
      </p>
      <Link href="/cart">Return to cart →</Link>
      <br />
      <Link href="/contact?topic=product">Get product support</Link>
    </section>
  );
}
export function OrderAccess() {
  const token = useSearchParams().get("token") ?? "";
  return <OrderDetails key={token} token={token} />;
}
function OrderDetails({ token }: { token: string }) {
  const [data, setData] = useState<Delivery | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let checks = 0;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/orders/access?token=${encodeURIComponent(token)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            "This private order link is unavailable. Check your email or contact BirdShop.",
          );
        if (controller.signal.aborted) return;
        setData(result as Delivery);
        setError("");
        checks++;
        if (
          !["sent", "cancelled"].includes(result.order.delivery_status) &&
          checks < 30
        )
          timer = setTimeout(() => {
            if (document.visibilityState === "visible") void refresh();
          }, 10000);
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Order status could not refresh. Reload this page to try again.",
          );
      }
    };
    void refresh();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [token]);
  return (
    <section className={styles.recovery}>
      <span className={styles.eyebrow}>PRIVATE DIGITAL DELIVERY</span>
      <h1>{data ? `Order ${data.order.reference}` : "Your purchased items"}</h1>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Opening your secure delivery…</p>}
      {data && (
        <>
          <p>
            Payment: {data.order.payment_status.replaceAll("_", " ")} ·{" "}
            {Number(data.order.total).toFixed(2)} {data.order.currency}
          </p>
          {Number(data.order.refunded_amount) > 0 && (
            <p>
              Refunded: {Number(data.order.refunded_amount).toFixed(2)}{" "}
              {data.order.currency}
            </p>
          )}
          <p role="status">
            {data.order.delivery_status === "sent"
              ? "Your code email was accepted by our email provider. Check your inbox and spam folder."
              : data.order.delivery_status === "cancelled"
                ? "Delivery stopped after the refund."
                : ["failed", "attention"].includes(data.order.delivery_status)
                  ? "Payment is recorded. Delivery needs attention; BirdShop can retry it without charging you again."
                  : "Payment recorded. Your codes are being prepared for email delivery."}
          </p>
          {data.items.map((item, index) => (
            <section
              className={styles.quote}
              key={`${index}-${item.product_name}`}
              style={{ margin: "20px 0" }}
            >
              <h2>{item.product_name}</h2>
              <p>
                {item.platform} · {item.region}
              </p>
              <p>Quantity: {item.quantity}</p>
            </section>
          ))}
          <p>
            Keep this private status link and your code email safe. Include your
            reference if you need help activating a product.
          </p>
        </>
      )}
      <Link href="/contact?topic=product">Product support →</Link>
    </section>
  );
}
