import Image from "next/image";
import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import styles from "./ComingSoonPage.module.css";

type ComingSoonPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel?: string;
};

// The primary actions already cover Home and Products.
const QUICK_LINKS = [
  {
    href: "/services",
    label: "Services",
    note: "Packages & custom quotes",
  },
  {
    href: "/how-to-order",
    label: "How to Order",
    note: "Every path, step by step",
  },
  {
    href: "/service-chat",
    label: "My Service",
    note: "Your private service chats",
  },
  {
    href: "/contact",
    label: "Contact",
    note: "Talk to BirdShop",
  },
];

export default function ComingSoonPage({
  eyebrow,
  title,
  description,
  statusLabel = "BirdShop / In development",
}: ComingSoonPageProps) {
  return (
    <main className="page-shell">
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.overlay} aria-hidden="true" />

        <div className={styles.glow} aria-hidden="true" />

        <div className={styles.content}>
          <p className={styles.eyebrow}>{eyebrow}</p>

          <h1>{title}</h1>

          <p className={styles.description}>{description}</p>

          <div className={styles.actions}>
            <Link href="/" className={styles.primary}>
              Return Home
              <span aria-hidden="true">→</span>
            </Link>

            <Link href="/products" className={styles.secondary}>
              Browse Products
            </Link>
          </div>

          <nav className={styles.quickLinks} aria-label="Popular pages">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles.quickLink}
              >
                <strong>{link.label}</strong>

                <span className={styles.quickNote}>{link.note}</span>

                <span className={styles.quickArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </nav>

          <div className={styles.status}>
            <span aria-hidden="true" />

            <p>{statusLabel}</p>
          </div>
        </div>

        {/* Theme-swapped logo pair: both load eagerly, CSS shows one. */}
        <div className={styles.monogram} aria-hidden="true">
          <Image
            src="/greenbs.png"
            alt=""
            width={300}
            height={300}
            className="theme-logo-light"
            loading="eager"
          />

          <Image
            src="/cremebs.png"
            alt=""
            width={300}
            height={300}
            className="theme-logo-dark"
            loading="eager"
          />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
