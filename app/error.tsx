"use client";

import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import styles from "@/components/ComingSoonPage.module.css";

// Production error messages from Server Components are generic; nothing internal is shown.
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="page-shell">
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.overlay} />
        <div className={styles.glow} />

        <div className={styles.content}>
          <p className={styles.eyebrow}>BirdShop / Temporarily unavailable</p>

          <h1>This page could not load.</h1>

          <p className={styles.description} role="alert">
            BirdShop could not reach part of the store just now. Nothing in your
            cart, payment or private chat has changed. Please try again in a
            moment.
          </p>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => retry()}
            >
              Try Again
              <span aria-hidden="true">↻</span>
            </button>

            <Link href="/" className={styles.secondary}>
              Return Home
            </Link>
          </div>
        </div>

        <div className={styles.monogram} aria-hidden="true">
          BS
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
