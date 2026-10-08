import type { Metadata } from "next";
import Link from "next/link";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import {
  ArrowIcon,
  CheckIcon,
  MessageIcon,
  ShieldIcon,
} from "@/components/SiteIcons";

import { GOOD_TO_KNOW } from "./content";
import OrderPaths from "./OrderPaths";
import s from "./how-to-order.module.css";

export const metadata: Metadata = {
  title: "How to Order",
  description:
    "How to order from BirdShop: digital codes delivered by email, fixed-price service packages with a private chat, or a custom request priced in chat. Secure Stripe checkout.",
};

// Without JavaScript the tabs cannot switch, so show every path instead.
const NO_JS_CSS =
  "[data-hto-panel][hidden]{display:block!important;margin-top:16px}[data-hto-tablist]{display:none}";

export default function HowToOrder() {
  return (
    <main className={`page-shell ${s.page}`}>
      <SiteHeader />

      <noscript>
        <style>{NO_JS_CSS}</style>
      </noscript>

      <section className={s.hero} aria-labelledby="hto-title">
        <div className={s.heroCopy}>
          <span className={s.eyebrow}>How to order</span>
          <h1 id="hto-title">
            Ordering, <em>made simple.</em>
          </h1>
          <p className={s.lede}>
            Pick what you’re buying and see every step, from checkout to
            delivery.
          </p>

          <ul className={s.trust} aria-label="Every order includes">
            <li>
              <ShieldIcon />
              Secure Stripe checkout
            </li>
            <li>
              <CheckIcon />
              No account needed
            </li>
            <li>
              <MessageIcon />
              Private links &amp; chat
            </li>
          </ul>
        </div>

        <Link href="/service-chat" className={s.returning}>
          <span className={s.eyebrow}>Already ordered?</span>
          <strong>Open My Service</strong>
          <small>
            Your private chats and service orders. Bought codes? They’re in
            your email.
          </small>
          <ArrowIcon />
        </Link>
      </section>

      <OrderPaths />

      <section className={s.faq} aria-labelledby="faq-title">
        <div className={s.faqHead}>
          <span className={s.eyebrow}>Good to know</span>
          <h2 id="faq-title">Quick answers.</h2>
          <p>Payment, privacy and support, in a sentence or two.</p>
          <Link className={s.secondary} href="/faqs">
            See All FAQs
          </Link>
        </div>

        <div className={s.faqList}>
          {GOOD_TO_KNOW.map(({ q, a }) => (
            <details key={q} className={s.faqItem}>
              <summary>
                {q}
                <span className={s.plus} aria-hidden="true" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className={s.helpWrap}>
        <section className={s.help} aria-labelledby="help-title">
          <div>
            <span className={s.eyebrow}>Still deciding?</span>
            <h2 id="help-title">Not sure which path fits?</h2>
            <p>Tell us what you need and we’ll point you the right way.</p>
          </div>

          <Link className={s.primary} href="/contact?topic=general">
            Ask BirdShop
            <ArrowIcon />
          </Link>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
