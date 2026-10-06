import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import styles from "@/app/service-chat/service-chat.module.css";
export const metadata = {
  title: "How to Order",
  description:
    "How to buy service packages, request custom work and order digital products from BirdShop.",
};
export default function HowToOrder() {
  return (
    <main className="page-shell">
      <SiteHeader />
      <section
        className={styles.recovery}
        style={{ marginTop: "140px", marginBottom: "80px" }}
      >
        <span className={styles.eyebrow}>BIRDSHOP / HOW TO ORDER</span>
        <h1>From your first message to delivery.</h1>
        <h2>Ready-to-buy service packages</h2>
        <ol>
          <li>
            Choose a service and review its Basic, Standard or Premium package.
          </li>
          <li>Enter your name and email, then pay securely through Stripe.</li>
          <li>
            Return directly to your private BirdShop chat. Once payment is
            verified, your order is linked there.
          </li>
          <li>
            Share your requirements and arrange the next steps in that chat.
          </li>
        </ol>
        <Link href="/services">Browse service packages →</Link>
        <h2>Custom services</h2>
        <ol>
          <li>
            Choose a service and start a private conversation through Contact.
          </li>
          <li>
            Discuss the scope, timing, and price with BirdShop. Opening a chat
            does not create an order.
          </li>
          <li>
            If payment is needed, open the payment request in your chat and pay
            securely through Stripe.
          </li>
          <li>
            After verified payment, your order is recorded. Continue in the same
            chat until the agreed work is completed.
          </li>
        </ol>
        <Link href="/contact?topic=service">
          Start a service conversation →
        </Link>
        <h2>Digital products</h2>
        <ol>
          <li>
            Choose a product and check its platform, region, and quantity.
          </li>
          <li>
            Add it to your cart, enter your email, and pay through Stripe.
          </li>
          <li>
            BirdShop verifies the payment and assigns the purchased codes.
          </li>
          <li>
            Check your email and spam folder. Keep your private order status
            link; it shows delivery progress.
          </li>
        </ol>
        <Link href="/products">Browse products →</Link>
        <p>
          Payment confirmation and email delivery can take time. If delivery
          needs attention, contact Product Support with your reference. Do not
          pay again or share codes publicly.
        </p>
        <p>
          Community Discord is an optional backup; your private on-site chat
          remains the main support channel.
        </p>
        <Link href="/reviews">Read customer reviews →</Link>
      </section>
      <SiteFooter />
    </main>
  );
}
