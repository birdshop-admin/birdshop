import type { Metadata } from "next";
import Link from "next/link";

import LegalPage, { type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "When BirdShop refunds digital codes and game services, how to ask, and how long refunds take.",
  alternates: { canonical: "/refunds" },
};

// Review this page before launch: it sets your refund rules. Keep it in line
// with what staff actually do in the admin chat.
const sections: readonly LegalSection[] = [
  {
    id: "before-payment",
    heading: "Before you pay",
    body: (
      <p>
        You are only charged once Stripe confirms your payment. If you leave
        checkout without paying, nothing is charged; the checkout expires after
        about 30 minutes and any reserved codes go back on sale.
      </p>
    ),
  },
  {
    id: "products",
    heading: "Digital products",
    body: (
      <>
        <p>
          A code can be viewed and used as soon as it is delivered, so digital
          product sales are final once the code has been delivered, except
          when:
        </p>
        <ul>
          <li>the code does not work or was already used before we sent it;</li>
          <li>we delivered a different product than the one you paid for;</li>
          <li>your code was never delivered.</li>
        </ul>
        <p>
          In those cases we will send a working replacement or refund you in
          full. Tell us as soon as you can and include the error message or a
          screenshot. If delivery is still pending, you can ask for a full
          refund instead of waiting.
        </p>
        <p>
          Codes bought for the wrong platform or region cannot be refunded
          after delivery, so check the product page before you buy.
        </p>
      </>
    ),
  },
  {
    id: "services",
    heading: "Game services",
    body: (
      <ul>
        <li>
          <strong>Before work starts:</strong> full refund on request.
        </li>
        <li>
          <strong>After work starts:</strong> we may offer a partial refund
          for the part that has not been done.
        </li>
        <li>
          <strong>After the order is complete:</strong> no refund unless the
          work was not delivered as agreed. Tell us in your chat (it stays open
          for about an hour after completion) or through the Contact page.
        </li>
        <li>
          <strong>If we cancel</strong> or cannot do the work, you get a full
          refund for anything not delivered.
        </li>
      </ul>
    ),
  },
  {
    id: "how-to-ask",
    heading: "How to ask for a refund",
    body: (
      <p>
        Message us in your service chat, or use the{" "}
        <Link href="/contact?topic=product">Contact page</Link> and choose
        Product Support. Include your order reference (it is in your order
        email) and what went wrong.
      </p>
    ),
  },
  {
    id: "timing",
    heading: "How refunds are paid",
    body: (
      <p>
        Approved refunds go back to the card you paid with, through Stripe.
        You get an email when we issue one. Most banks show the refund within
        5 to 10 business days. Refunds can be full or partial depending on the
        case.
      </p>
    ),
  },
  {
    id: "disputes",
    heading: "Chargebacks",
    body: (
      <p>
        Please contact us before you open a dispute with your bank; we can
        usually fix the problem faster. If a dispute is opened, we will share
        the order and delivery records with Stripe, and related orders may be
        paused while it is reviewed.
      </p>
    ),
  },
  {
    id: "rights",
    heading: "Your legal rights",
    body: (
      <p>
        This policy does not affect any rights you have under the consumer
        laws that apply to you.
      </p>
    ),
  },
];

export default function RefundsPage() {
  return (
    <LegalPage
      path="/refunds"
      eyebrow="Policies"
      title="Refund Policy"
      updated="October 8, 2026"
      summary={
        <p>
          If a code does not work or a service is not delivered as agreed, we
          will make it right. Here is exactly when refunds apply and how to ask.
        </p>
      }
      sections={sections}
    />
  );
}
