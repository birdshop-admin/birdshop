import type { Metadata } from "next";

import LegalPage, { type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What BirdShop collects when you browse, buy or chat with us, why, and who helps us process it.",
  alternates: { canonical: "/privacy" },
};

// Review this page before launch. It describes what the code collects today:
// keep it in sync if analytics, cookies or service providers change.
const sections: readonly LegalSection[] = [
  {
    id: "collect",
    heading: "What we collect",
    body: (
      <ul>
        <li>
          <strong>Orders:</strong> your name, delivery email, the items you
          bought, amounts, your order reference and delivery status.
        </li>
        <li>
          <strong>Payments:</strong> Stripe handles your card details on its
          own secure page. We receive the payment result and Stripe&rsquo;s
          payment references, never your full card number.
        </li>
        <li>
          <strong>Chats and messages:</strong> what you send in a service chat
          or through the Contact page, including your name and email.
        </li>
        <li>
          <strong>Reviews:</strong> the name or handle, rating and text you
          submit. Approved reviews are shown publicly on the site.
        </li>
        <li>
          <strong>Security data:</strong> to stop abuse we record request
          counts against a scrambled (one-way, keyed) version of your IP
          address or email, not the address itself. These records are deleted
          after about two days.
        </li>
        <li>
          <strong>Site analytics:</strong> a random visitor ID stored in your
          browser and the general area of the site you viewed (for example
          &ldquo;a product page&rdquo;). We use this only for visit counts. We
          do not use advertising trackers or third-party analytics.
        </li>
      </ul>
    ),
  },
  {
    id: "storage",
    heading: "Cookies and browser storage",
    body: (
      <>
        <p>We only use storage the site needs to work:</p>
        <ul>
          <li>
            <strong>Chat access cookies</strong> keep you signed in to My
            Service after you verify your email, and can remember chats on this
            device for up to 30 days if you choose.
          </li>
          <li>
            <strong>Browser storage</strong> keeps your cart, your light or
            dark mode choice, your visitor ID, saved chat links and any
            checkout you have in progress.
          </li>
          <li>
            Staff sign-in cookies are used only in the staff area.
          </li>
        </ul>
        <p>
          We do not use advertising or cross-site tracking cookies. Clearing
          your browser data removes everything stored on your device.
        </p>
      </>
    ),
  },
  {
    id: "use",
    heading: "How we use it",
    body: (
      <ul>
        <li>to deliver your codes and services and send order emails;</li>
        <li>to answer your messages and give support;</li>
        <li>to prevent fraud, abuse and stock hoarding;</li>
        <li>to keep the records we need for accounting, tax and disputes;</li>
        <li>to understand overall site traffic.</li>
      </ul>
    ),
  },
  {
    id: "providers",
    heading: "Who helps us",
    body: (
      <>
        <p>
          We do not sell your personal information. We share it only with the
          providers that run parts of the store for us:
        </p>
        <ul>
          <li>
            <strong>Stripe</strong> processes payments and refunds.
          </li>
          <li>
            <strong>Supabase</strong> hosts our database and file storage.
          </li>
          <li>
            <strong>Resend</strong> sends our emails.
          </li>
          <li>
            <strong>Vercel</strong> hosts the website.
          </li>
          <li>
            <strong>Cloudflare</strong> may run a bot check at checkout.
          </li>
        </ul>
        <p>
          Each provider handles data under its own terms and privacy policy. We
          may also share information when the law requires it, or to protect
          customers and the store from fraud.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: (
      <p>
        We keep order and payment records for as long as we need them for
        accounting, tax, disputes and fraud prevention. Chats and contact
        requests are kept while they are useful for support and order history
        and may be removed sooner. Security records are deleted after about two
        days, and remembered-device access ends after 30 days.
      </p>
    ),
  },
  {
    id: "rights",
    heading: "Your choices",
    body: (
      <p>
        You can ask us for a copy of your information, ask us to correct it,
        or ask us to delete it by contacting us. We may need to keep some
        records, such as payment history, where the law requires it. You can
        also clear your browser data at any time.
      </p>
    ),
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <p>
        The site uses HTTPS, digital codes are encrypted before they are
        stored, and only authorized staff can see order and chat details. No
        system is perfectly secure, so please keep your order emails and
        private links to yourself.
      </p>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: (
      <p>
        BirdShop is not meant for children under 13, and we do not knowingly
        collect their information. If you think a child has sent us personal
        information, contact us and we will remove it.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        We may update this policy as the store changes. The date at the top
        shows the latest version.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      path="/privacy"
      eyebrow="Policies"
      title="Privacy Policy"
      updated="October 8, 2026"
      summary={
        <p>
          We collect what we need to deliver your order and keep the store
          safe, and nothing for advertising.
        </p>
      }
      sections={sections}
    />
  );
}
