import type { Metadata } from "next";
import Link from "next/link";

import LegalPage, { type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that apply when you use BirdShop or buy digital game products and services.",
  alternates: { canonical: "/terms" },
};

// Review this page before launch. It is written for how the store works today
// (Stripe card checkout, emailed codes, chat-based services). It names no legal
// entity or governing law: add those once you have decided them.
const sections: readonly LegalSection[] = [
  {
    id: "about",
    heading: "About these terms",
    body: (
      <>
        <p>
          BirdShop (&ldquo;BirdShop&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          runs birdshop.store, where we sell digital game products such as
          keys and codes, and game-related services delivered through a private
          chat.
        </p>
        <p>
          By using the site or placing an order you agree to these terms, our{" "}
          <Link href="/refunds">Refund Policy</Link> and our{" "}
          <Link href="/privacy">Privacy Policy</Link>. If you do not agree,
          please do not use the site.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    heading: "Who can buy",
    body: (
      <>
        <p>
          You must be at least 18, or the age of majority where you live, to
          buy from BirdShop. If you are younger, a parent or guardian must
          place the order or agree to it.
        </p>
        <p>
          Give us accurate details, especially your delivery email. You are
          responsible for keeping your email account, your private order links
          and your chat links secure. Anyone with those links can view your
          order or chat.
        </p>
      </>
    ),
  },
  {
    id: "products",
    heading: "Digital products",
    body: (
      <>
        <ul>
          <li>
            Each product page lists the platform, region and any requirements.
            <strong> Check them before you buy.</strong> A code for the wrong
            platform or region usually cannot be used or exchanged.
          </li>
          <li>
            Codes are emailed after Stripe confirms your payment, usually
            within minutes. You also get a private page that shows delivery
            status.
          </li>
          <li>
            While you pay, the codes in your checkout are held for about 30
            minutes. Unpaid checkouts expire and the codes go back on sale. An
            order can hold up to 10 codes.
          </li>
          <li>
            Codes are for your own use or as a gift. Keep them private: once a
            code is delivered, we cannot control who sees or redeems it.
          </li>
          <li>
            Activation and play are handled by the game or platform provider
            and are subject to their own terms.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "services",
    heading: "Game services",
    body: (
      <>
        <p>
          Services are sold as fixed-price packages or as custom requests that
          we price in your private chat. The package description, or what we
          agree in chat, sets the scope of the work.
        </p>
        <ul>
          <li>
            Work starts after payment is confirmed and we have the details we
            need from you. Time estimates are our best guess, not a guarantee.
          </li>
          <li>
            Please give us accurate information and reply in the chat when we
            need something. Delays on your side can delay the work.
          </li>
          <li>
            When the work is done we mark the order complete and email you.
            The chat stays open for about an hour so you can ask a last
            question, then it closes.
          </li>
          <li>
            We may decline any request. If we cancel paid work before it
            starts, you get a full refund.
          </li>
          <li>
            Some games and platforms limit account sharing or third-party
            help. You are responsible for checking and following the rules of
            the games and platforms you use.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "payment",
    heading: "Prices and payment",
    body: (
      <>
        <p>
          Prices are in US dollars. Card payments are processed by Stripe on a
          secure Stripe page; BirdShop never sees or stores your full card
          number. An order is paid only when Stripe confirms the payment to us.
          Returning to the site from Stripe is not, by itself, a confirmed
          payment.
        </p>
        <p>
          Prices can change at any time, but never for an order you have
          already paid. If an order was paid at an obviously wrong price, or a
          product turns out to be unavailable, we may cancel it and refund you
          in full.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    heading: "Refunds and disputes",
    body: (
      <p>
        Refunds follow our <Link href="/refunds">Refund Policy</Link>. If
        something is wrong with an order, please contact us before opening a
        dispute with your bank. Most problems are faster to fix directly.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    body: (
      <>
        <p>When you use BirdShop, you agree not to:</p>
        <ul>
          <li>use a card or account you are not authorized to use;</li>
          <li>
            use bots or scripts, or open checkouts you do not intend to pay
            for, to hold stock away from other customers;
          </li>
          <li>
            try to access other people&rsquo;s orders or chats, or any staff
            area of the site;
          </li>
          <li>harass or threaten our staff or other customers;</li>
          <li>use the site for anything unlawful.</li>
        </ul>
        <p>
          We may cancel orders, refuse service or block access when we
          reasonably suspect fraud or abuse. Paid orders we cancel before
          delivery are refunded.
        </p>
      </>
    ),
  },
  {
    id: "trademarks",
    heading: "Trademarks and affiliation",
    body: (
      <p>
        Game names, logos and trademarks belong to their owners and are used
        only to describe the products and services we offer. BirdShop is
        independent. It is not affiliated with, endorsed by or sponsored by any
        game publisher, developer or platform unless we say so.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "Disclaimers and liability",
    body: (
      <>
        <p>
          We work to keep the site accurate and available, but it is provided
          &ldquo;as is&rdquo; and may sometimes be unavailable or contain
          errors.
        </p>
        <p>
          To the extent the law allows, BirdShop is not liable for indirect or
          consequential losses, and our total liability for any claim about an
          order is limited to the amount you paid for that order. Nothing in
          these terms limits any right you have that cannot be limited by law.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these terms. The date at the top shows the latest
        version. The version in effect when you place an order applies to that
        order.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      path="/terms"
      eyebrow="Policies"
      title="Terms of Service"
      updated="October 8, 2026"
      summary={
        <p>
          The rules for using BirdShop and buying from us, in plain language:
          what you get, how payment works, and what we expect from each other.
        </p>
      }
      sections={sections}
    />
  );
}
