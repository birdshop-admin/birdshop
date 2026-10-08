import Link from "next/link";
import type { ReactNode } from "react";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

import s from "./LegalPage.module.css";

export type LegalSection = {
  id: string;
  heading: string;
  body: ReactNode;
};

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refunds", label: "Refund Policy" },
] as const;

// Shared layout for the Terms, Privacy and Refund pages: a short summary,
// an on-page contents list, and numbered sections.
export default function LegalPage({
  path,
  eyebrow,
  title,
  summary,
  updated,
  sections,
}: {
  path: (typeof LEGAL_LINKS)[number]["href"];
  eyebrow: string;
  title: string;
  summary: ReactNode;
  updated: string;
  sections: readonly LegalSection[];
}) {
  return (
    <main className={`page-shell ${s.page}`}>
      <SiteHeader />

      <header className={s.hero}>
        <span className={s.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <div className={s.summary}>{summary}</div>
        <p className={s.updated}>Last updated {updated}</p>
      </header>

      <div className={s.layout}>
        <aside className={s.aside}>
          <nav aria-label="On this page" className={s.toc}>
            <strong>On this page</strong>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.heading}</a>
                </li>
              ))}
            </ol>
          </nav>

          <nav aria-label="Policies" className={s.policies}>
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.href === path ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className={s.article}>
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className={s.section}
              aria-labelledby={`${section.id}-title`}
            >
              <h2 id={`${section.id}-title`}>
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.heading}
              </h2>
              {section.body}
            </section>
          ))}

          <aside className={s.help}>
            <div>
              <strong>Questions about this policy?</strong>
              <p>
                Send us a message and include your order reference if it is
                about a purchase.
              </p>
            </div>
            <Link href="/contact?topic=general">Contact BirdShop</Link>
          </aside>
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}
