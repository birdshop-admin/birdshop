import Link from "next/link";
import styles from "./AlternativePaymentInfo.module.css";

/**
 * Informational only. Do not ask customers to submit third-party voucher
 * codes until an authorized verification/redemption process is contracted.
 * Card payments continue to be handled exclusively by existing Stripe.
 */
export default function AlternativePaymentInfo() {
  return (
    <section className={styles.panel} aria-labelledby="alternate-payments-title">
      <h4 id="alternate-payments-title">Other ways to pay</h4>
      <details className={styles.details}>
        <summary>Rewarble prepaid card <span>Use card checkout</span></summary>
        <p>
          Have a Rewarble voucher? You can redeem it with Rewarble for an
          eligible virtual Visa or Mastercard, then use that card in our
          existing secure checkout, subject to card issuer and processor approval.
        </p>
        <a href="https://rewarble.com/redeem" target="_blank"
          rel="noopener noreferrer">Redeem on Rewarble ↗</a>
      </details>
      <details className={styles.details}>
        <summary>Rewarble voucher code <span>Manual inquiry</span></summary>
        <p>
          Direct voucher-code payments are not automated yet. Please ask
          BirdShop support about eligibility before sharing a code.
          A support request is not a completed payment and does not reserve stock.
        </p>
        <Link href="/contact?topic=rewarble-payment">
          Ask about voucher payments ↗
        </Link>
      </details>
      <details className={styles.details}>
        <summary>Cryptocurrency <span>Integration pending</span></summary>
        <p>
          Crypto checkout requires a verified provider invoice and payment
          confirmation before digital delivery. It is not active yet.
          You can continue to pay securely by card using Stripe.
        </p>
      </details>
    </section>
  );
}
