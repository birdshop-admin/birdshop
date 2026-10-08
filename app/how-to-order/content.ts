/* =========================================================
   HOW TO ORDER: static content

   Shared by page.tsx (server) and OrderPaths.tsx (client).
   Plain module: no "use client", no server-only.

   The copy is tied to how the store works today. If any of these
   change, update this file:
   - MAX_UNITS_PER_CHECKOUT = 10 (app/api/checkout/route.ts)
   - Card-only Stripe Checkout (lib/payment-service.ts)
   - Delivery email "Your BirdShop codes · REF" with a
     "View order status" link (lib/email-jobs.ts)
   - Service packages: /services/[slug]/purchase -> Stripe ->
     /services/checkout, which opens the chat only after verified
     payment; payment-confirmed and order-completed emails
     (lib/email/payment-confirmed.ts, order-completed.ts)
   - Custom requests: Contact (topic=service) opens the chat right
     away; the owner sends a payment request in the chat
   - No email is sent for new chat messages: never promise one
   - My Service remembers chats started on this device (30 days);
     other devices verify by email

   Eyebrows and labels are sentence case here; CSS uppercases them.
   Customer-facing copy follows the shared copy table in the design
   brief (package names Basic / Standard / Premium, "Custom quote").
========================================================= */

export type PathId = "products" | "services" | "custom";

export const DEFAULT_PATH: PathId = "products";

const PATH_IDS: readonly PathId[] = ["products", "services", "custom"];

export function isPathId(value: string): value is PathId {
  return (PATH_IDS as readonly string[]).includes(value);
}

export type OrderStep = {
  /** Where the step happens (shown as a small chip). */
  where: string;
  title: string;
  copy: string;
};

export type OrderAfterItem = {
  term: string;
  detail: string;
};

export type OrderLink = {
  href: string;
  label: string;
};

export type OrderPath = {
  id: PathId;
  /** Tab label and supporting line. */
  label: string;
  sub: string;
  eyebrow: string;
  title: string;
  intro: string;
  steps: readonly OrderStep[];
  afterTitle: string;
  /** Exactly three entries: what you get, timing, where to find it later. */
  after: readonly [OrderAfterItem, OrderAfterItem, OrderAfterItem];
  primary: OrderLink;
  secondary: OrderLink;
  note?: {
    text: string;
    action: string;
    target: PathId;
  };
};

export const ORDER_PATHS: readonly OrderPath[] = [
  {
    id: "products",
    label: "Digital product",
    sub: "Game keys and codes, delivered by email",
    eyebrow: "Digital products · 4 steps",
    title: "Check out once. Codes in your inbox.",
    intro: "Codes are emailed after payment. No account needed.",
    steps: [
      {
        where: "Products",
        title: "Pick your product",
        copy: "Check the platform and region on the product page, then add it to your cart.",
      },
      {
        where: "Cart",
        title: "Add your details",
        copy: "Set quantities (up to 10 codes per order) and enter your name and delivery email.",
      },
      {
        where: "Stripe",
        title: "Pay securely",
        copy: "Pay by card on Stripe. Your codes are reserved while you pay.",
      },
      {
        where: "Your inbox",
        title: "Receive your codes",
        copy: "Once payment is confirmed, we email your codes and a private order-status link.",
      },
    ],
    afterTitle: "After you pay",
    after: [
      {
        term: "You get",
        detail: "Your codes by email, plus a private page that tracks delivery.",
      },
      {
        term: "Timing",
        detail: "Usually within minutes of payment confirmation.",
      },
      {
        term: "Later",
        detail: "Search your inbox for “Your BirdShop codes”. Keep that email private.",
      },
    ],
    primary: { href: "/products", label: "Browse Products" },
    secondary: { href: "/contact?topic=product", label: "Get Product Support" },
  },
  {
    id: "services",
    label: "Ready-made service",
    sub: "Fixed-price Basic, Standard or Premium packages",
    eyebrow: "Service packages · 4 steps",
    title: "Choose a package. Pay. Start your chat.",
    intro: "Set prices and clear inclusions, so you know exactly what you’re paying for.",
    steps: [
      {
        where: "Services",
        title: "Choose a package",
        copy: "Compare Basic, Standard and Premium: price, what’s included and turnaround.",
      },
      {
        where: "Package page",
        title: "Add your details",
        copy: "Enter your name and email. No account or password needed.",
      },
      {
        where: "Stripe",
        title: "Pay securely",
        copy: "Pay by card on Stripe’s secure checkout.",
      },
      {
        where: "My Service",
        title: "Your private chat opens",
        copy: "Once payment is confirmed, you land in your chat to share details and get started.",
      },
    ],
    afterTitle: "After you pay",
    after: [
      {
        term: "You get",
        detail: "A private chat with BirdShop and an emailed receipt with your chat link.",
      },
      {
        term: "Timing",
        detail: "Your chat opens once payment is confirmed. Each service lists its turnaround.",
      },
      {
        term: "When it’s done",
        detail: "We email you when your order is marked complete.",
      },
    ],
    note: {
      text: "Some services are custom quote only and have no packages.",
      action: "See How Custom Requests Work",
      target: "custom",
    },
    primary: { href: "/services", label: "Explore Services" },
    secondary: { href: "/service-chat", label: "Open My Service" },
  },
  {
    id: "custom",
    label: "Custom request",
    sub: "Tailored work, price agreed in chat",
    eyebrow: "Custom requests · 4 steps",
    title: "Share your idea. Agree a price. Then pay.",
    intro:
      "For services offered by custom quote only, or anything beyond a package. You only pay once the details are agreed.",
    steps: [
      {
        where: "Contact",
        title: "Send your request",
        copy: "Choose the service and describe what you need. Your private chat opens right away.",
      },
      {
        where: "Private chat",
        title: "Agree the details",
        copy: "We confirm scope, price and timing with you in the chat.",
      },
      {
        where: "Private chat",
        title: "Pay the request",
        copy: "Open the payment request in your chat and pay securely through Stripe.",
      },
      {
        where: "My Service",
        title: "We get to work",
        copy: "Updates stay in your chat, and we email you when the order is complete.",
      },
    ],
    afterTitle: "Before and after you pay",
    after: [
      {
        term: "Before you pay",
        detail: "No order or charge until you pay a request in your chat.",
      },
      {
        term: "Timing",
        detail: "Replies arrive in your chat; times vary with demand. Turnaround is agreed before you pay.",
      },
      {
        term: "Later",
        detail: "Your confirmation email has your reference and chat link. The chat is also saved in My Service.",
      },
    ],
    primary: { href: "/contact?topic=service", label: "Start a Custom Request" },
    secondary: { href: "/services", label: "Browse Services First" },
  },
];

export const GOOD_TO_KNOW: readonly { q: string; a: string }[] = [
  {
    q: "Is my payment secure?",
    a: "Yes. You pay by card on Stripe’s secure checkout. BirdShop never sees or stores your card details.",
  },
  {
    q: "Do I need an account?",
    a: "No, just an email address. Your orders and chats open through private links we send you, so don’t share them.",
  },
  {
    q: "Where do I find my order or chat later?",
    a: "Codes and their order-status link are in your email. Service chats live in My Service: chats started on this device appear automatically, and on another device you can verify your email to see them all.",
  },
  {
    q: "Payment is taking a while to confirm.",
    a: "Your status page updates by itself. Please don’t pay again. Check your email and spam folder, or contact us with your reference.",
  },
  {
    q: "I left checkout before paying.",
    a: "Nothing is charged until Stripe confirms payment. For products, return to your cart to resume or cancel the saved checkout. Unpaid checkouts expire and reserved codes are released.",
  },
  {
    q: "Refunds and support",
    a: "Message us in your private chat, or choose Product Support on Contact with your order reference. Eligibility depends on whether the item was delivered or the work has started.",
  },
  {
    q: "I just have a question.",
    a: "Choose Product Support or General Support on Contact. It opens a private chat with no payment involved.",
  },
];
