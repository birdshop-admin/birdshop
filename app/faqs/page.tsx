"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import {
  ArrowIcon,
  ClockIcon,
  MessageIcon,
  PeopleIcon,
  ShieldIcon,
} from "@/components/SiteIcons";

import {
  faqCategories,
  faqs,
  type FAQ,
  type FAQFilter,
} from "@/lib/faqs";

import styles from "./faqs.module.css";

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function FAQRow({
  faq,
  number,
  open,
  onToggle,
}: {
  faq: FAQ;
  number: number;
  open: boolean;
  onToggle: () => void;
}) {
  const answerId =
    `${faq.id}-answer`;

  return (
    <article
      className={`${styles.faqRow} ${
        open
          ? styles.faqRowOpen
          : ""
      }`}
    >
      <button
        type="button"
        className={styles.faqQuestion}
        aria-expanded={open}
        aria-controls={answerId}
        onClick={onToggle}
      >
        <span className={styles.faqNumber}>
          {String(number).padStart(2, "0")}
        </span>

        <div className={styles.faqQuestionCopy}>
          <span>{faq.category}</span>
          <h3>{faq.question}</h3>
        </div>

        <span
          className={styles.faqToggle}
          aria-hidden="true"
        >
          {open ? "−" : "+"}
        </span>
      </button>

      <div
        id={answerId}
        className={styles.faqAnswerWrap}
        aria-hidden={!open}
      >
        <div className={styles.faqAnswer}>
          <div className={styles.answerLine} />
          <p>{faq.answer}</p>
        </div>
      </div>
    </article>
  );
}

export default function FAQsPage() {
  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState<FAQFilter>(
      "All Questions"
    );

  /*
   * Deliberately empty.
   * No FAQ, including #01, opens automatically.
   */
  const [openItems, setOpenItems] =
    useState<Set<string>>(
      new Set()
    );

  const filteredFAQs =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return faqs.filter((faq) => {
        const categoryMatch =
          category === "All Questions" ||
          faq.category === category;

        const searchMatch =
          query.length === 0 ||
          faq.question
            .toLowerCase()
            .includes(query) ||
          faq.answer
            .toLowerCase()
            .includes(query) ||
          faq.tags.some((tag) =>
            tag
              .toLowerCase()
              .includes(query)
          );

        return (
          categoryMatch &&
          searchMatch
        );
      });
    }, [search, category]);

  const featuredFAQs =
    faqs
      .filter((faq) =>
        faq.featured
      )
      .slice(0, 3);

  function toggleFAQ(
    id: string
  ) {
    setOpenItems((current) => {
      const next =
        new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function changeCategory(
    nextCategory: FAQFilter
  ) {
    setCategory(nextCategory);
    setOpenItems(new Set());
  }

  function updateSearch(
    value: string
  ) {
    setSearch(value);
    setOpenItems(new Set());
  }

  function resetFilters() {
    setSearch("");
    setCategory("All Questions");
    setOpenItems(new Set());
  }

  function openFeatured(
    faq: FAQ
  ) {
    setCategory("All Questions");
    setSearch("");
    setOpenItems(
      new Set([faq.id])
    );

    window.setTimeout(() => {
      document
        .getElementById(faq.id)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  }

  function categoryCount(
    item: FAQFilter
  ) {
    if (item === "All Questions") {
      return faqs.length;
    }

    return faqs.filter(
      (faq) =>
        faq.category === item
    ).length;
  }

  return (
    <main className="page-shell">
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              BIRDSHOP / HELP CENTER
            </p>

            <h1>
              Questions,
              <br />
              answered.
            </h1>

            <p className={styles.heroDescription}>
              Everything you need to know about BirdShop
              products, services, delivery, payments, and
              support — without digging through pages of
              information.
            </p>

            <label className={styles.heroSearch}>
              <SearchIcon />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  updateSearch(
                    event.target.value
                  )
                }
                placeholder="Search BirdShop questions..."
                aria-label="Search FAQs"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    updateSearch("")
                  }
                  aria-label="Clear FAQ search"
                >
                  ×
                </button>
              )}
            </label>
          </div>

          <div className={styles.heroMark}>
            <span>BS</span>
            <div />
            <strong>FAQ</strong>
            <small>
              ANSWERS
              <br />
              SUPPORT
              <br />
              CLARITY
            </small>
          </div>
        </div>
      </section>

      <section className={styles.infoStrip}>
        <div>
          <ShieldIcon />
          <div>
            <strong>Product Clarity</strong>
            <span>PLATFORM · REGION · STOCK</span>
          </div>
        </div>

        <div>
          <PeopleIcon />
          <div>
            <strong>Service Guidance</strong>
            <span>PACKAGES · SCOPE · REQUESTS</span>
          </div>
        </div>

        <div>
          <ClockIcon />
          <div>
            <strong>Delivery Answers</strong>
            <span>DIGITAL · TIMING · SUPPORT</span>
          </div>
        </div>

        <div>
          <MessageIcon />
          <div>
            <strong>Need More Help?</strong>
            <span>SUBMIT A SUPPORT REQUEST</span>
          </div>
        </div>
      </section>

      <section className={styles.popularSection}>
        <div className={styles.popularHeading}>
          <div>
            <span>START HERE</span>
            <h2>Most Asked</h2>
          </div>

          <p>
            Quick answers to some of the most important
            BirdShop questions. These only open when you
            choose one.
          </p>
        </div>

        <div className={styles.popularGrid}>
          {featuredFAQs.map((faq, index) => (
            <button
              key={faq.id}
              type="button"
              className={styles.popularCard}
              onClick={() =>
                openFeatured(faq)
              }
            >
              <div className={styles.popularTop}>
                <span>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <small>{faq.category}</small>
              </div>

              <h3>{faq.question}</h3>

              <div className={styles.popularBottom}>
                <span>Read Answer</span>
                <ArrowIcon />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.librarySection}>
        <div className={styles.libraryHeading}>
          <div>
            <span>BIRDSHOP HELP CENTER</span>
            <h2>Find your answer.</h2>
          </div>

          <p>
            {filteredFAQs.length} {filteredFAQs.length === 1
              ? "question"
              : "questions"}
          </p>
        </div>

        <div className={styles.libraryLayout}>
          <aside className={styles.sidebar}>
            <label className={styles.sidebarSearch}>
              <SearchIcon />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  updateSearch(
                    event.target.value
                  )
                }
                placeholder="Search questions"
                aria-label="Search FAQ library"
              />
            </label>

            <div className={styles.categoryBlock}>
              <span>CATEGORY</span>

              <div className={styles.categoryList}>
                {faqCategories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={
                      category === item
                        ? styles.categoryActive
                        : ""
                    }
                    onClick={() =>
                      changeCategory(item)
                    }
                  >
                    <span>{item}</span>
                    <small>
                      {categoryCount(item)}
                    </small>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.helpCard}>
              <span>STILL NEED HELP?</span>
              <h3>Talk to BirdShop.</h3>
              <p>
                If the answer is not here, submit a real
                support request. The same context can later
                continue into BirdShop live chat.
              </p>

              <Link href="/contact?topic=general">
                Contact Support
                <ArrowIcon />
              </Link>
            </div>
          </aside>

          <div className={styles.faqArea}>
            <div className={styles.resultBar}>
              <p>
                Showing <strong>{filteredFAQs.length}</strong>{" "}
                {category === "All Questions"
                  ? "BirdShop questions"
                  : `questions in ${category}`}
              </p>

              {(search ||
                category !== "All Questions") && (
                <button
                  type="button"
                  onClick={resetFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {filteredFAQs.length > 0 ? (
              <div className={styles.faqList}>
                {filteredFAQs.map((faq, index) => (
                  <div
                    key={faq.id}
                    id={faq.id}
                    className={styles.faqAnchor}
                  >
                    <FAQRow
                      faq={faq}
                      number={index + 1}
                      open={openItems.has(faq.id)}
                      onToggle={() =>
                        toggleFAQ(faq.id)
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <SearchIcon />
                </div>

                <span>NO ANSWERS FOUND</span>
                <h3>Nothing matches that search.</h3>
                <p>
                  Try another term or reset the FAQ filters.
                </p>

                <button
                  type="button"
                  onClick={resetFilters}
                >
                  Show All Questions
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.contactCta}>
        <div className={styles.contactOverlay} />

        <div className={styles.contactCopy}>
          <span>CAN&apos;T FIND YOUR ANSWER?</span>
          <h2>We&apos;re still here.</h2>
          <p>
            Use BirdShop Contact for Product Help, a Service
            Request, General Support, or to leave a review.
            Support requests are saved with their own
            reference so the conversation can continue later.
          </p>
        </div>

        <div className={styles.contactActions}>
          <Link href="/contact?topic=general">
            <MessageIcon />
            Contact BirdShop
            <ArrowIcon />
          </Link>

          <small>
            Live chat will plug into the same support context
            when the chat widget is connected.
          </small>
        </div>
      </section>

      <section className={styles.quickLinks}>
        <Link href="/products">
          <ShieldIcon />
          <div>
            <span>DIGITAL STORE</span>
            <strong>Browse Products</strong>
            <p>
              Check pricing, platform, region, availability,
              and delivery information.
            </p>
          </div>
          <ArrowIcon />
        </Link>

        <Link href="/services">
          <PeopleIcon />
          <div>
            <span>GAME SERVICES</span>
            <strong>Browse Services</strong>
            <p>
              Compare Basic, Standard, Premium, and custom
              service options.
            </p>
          </div>
          <ArrowIcon />
        </Link>

        <Link href="/reviews">
          <MessageIcon />
          <div>
            <span>COMMUNITY</span>
            <strong>Read Reviews</strong>
            <p>
              See approved product and service experiences,
              with sample data clearly labeled during setup.
            </p>
          </div>
          <ArrowIcon />
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
