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

export default function ComingSoonPage({
  eyebrow,
  title,
  description,
  statusLabel = "BIRDSHOP / IN DEVELOPMENT",
}: ComingSoonPageProps) {
  return (
    <main className="page-shell">
      <SiteHeader />

      <section
        className={
          styles.hero
        }
      >
        <div
          className={
            styles.overlay
          }
        />

        <div
          className={
            styles.glow
          }
        />

        <div
          className={
            styles.content
          }
        >
          <p
            className={
              styles.eyebrow
            }
          >
            {eyebrow}
          </p>

          <h1>
            {title}
          </h1>

          <p
            className={
              styles.description
            }
          >
            {description}
          </p>

          <div
            className={
              styles.actions
            }
          >
            <Link
              href="/"
              className={
                styles.primary
              }
            >
              Return Home

              <span>
                →
              </span>
            </Link>

            <Link
              href="/products"
              className={
                styles.secondary
              }
            >
              Browse Products
            </Link>
          </div>

          <div
            className={
              styles.status
            }
          >
            <span />

            <p>
              {statusLabel}
            </p>
          </div>
        </div>

        <div
          className={
            styles.monogram
          }
        >
          BS
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}