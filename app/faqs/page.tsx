"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import {
  ArrowIcon,
  ClockIcon,
  MessageIcon,
  PeopleIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/SiteIcons";

import {
  faqCategories,
  faqs,
  type FAQ,
  type FAQFilter,
} from "@/lib/faqs";

import styles from "./faqs.module.css";

const ALL_QUESTIONS: FAQFilter = "All Questions";

const featuredFAQs = faqs.filter((faq) => faq.featured).slice(0, 3);

function categoryCount(item: FAQFilter) {
  if (item === ALL_QUESTIONS) return faqs.length;

  return faqs.filter((faq) => faq.category === item).length;
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
  const answerId = `${faq.id}-answer`;

  return (
    <article
      className={`${styles.faqRow} ${open ? styles.faqRowOpen : ""}`}
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

        <span className={styles.faqToggle} aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {/* Collapsed answers stay in the DOM for the height animation, but are
          inert: out of the tab order and the accessibility tree. */}
      <div id={answerId} className={styles.faqAnswerWrap} inert={!open}>
        <div className={styles.faqAnswer}>
          <div className={styles.answerLine} />
          <p>{faq.answer}</p>
        </div>
      </div>
    </article>
  );
}

export default function FAQsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FAQFilter>(ALL_QUESTIONS);

  // Deliberately empty: no FAQ, including #01, opens automatically.
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());

  const filteredFAQs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return faqs.filter((faq) => {
      const categoryMatch =
        category === ALL_QUESTIONS || faq.category === category;

      const searchMatch =
        query.length === 0 ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.tags.some((tag) => tag.toLowerCase().includes(query));

      return categoryMatch && searchMatch;
    });
  }, [search, category]);

  function toggleFAQ(id: string) {
    setOpenItems((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function changeCategory(nextCategory: FAQFilter) {
    setCategory(nextCategory);
    setOpenItems(new Set());
  }

  function updateSearch(value: string) {
    setSearch(value);
    setOpenItems(new Set());
  }

  function resetFilters() {
    setSearch("");
    setCategory(ALL_QUESTIONS);
    setOpenItems(new Set());
  }

  function openFeatured(faq: FAQ) {
    setCategory(ALL_QUESTIONS);
    setSearch("");
    setOpenItems(new Set([faq.id]));

    // The click's update has rendered by the next frame. Script smooth
    // scrolling ignores the CSS reduced-motion rule, so check it here.
    window.requestAnimationFrame(() => {
      const row = document.getElementById(faq.id);

      if (!row) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      row.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });

      row.querySelector("button")?.focus({ preventScroll: true });
    });
  }

  return (
    <main className="page-shell">
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>BirdShop / Help center</p>

            <h1>
              Questions,
              <br />
              answered.
            </h1>

            <p className={styles.heroDescription}>
              Everything you need to know about BirdShop products, services,
              delivery, payments, and support — without digging through pages
              of information.
            </p>

            <label className={styles.heroSearch}>
              <SearchIcon />

              <input
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search BirdShop questions…"
                aria-label="Search FAQs"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => updateSearch("")}
                  aria-label="Clear FAQ search"
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </label>
          </div>

          <div className={styles.heroMark} aria-hidden="true">
            <span>BS</span>
            <div />
            <strong>FAQ</strong>
            <small>
              Answers
              <br />
              Support
              <br />
              Clarity
            </small>
          </div>
        </div>
      </section>

      <section className={styles.infoStrip}>
        <div>
          <ShieldIcon />
          <div>
            <strong>Product clarity</strong>
            <span>Platform · Region · Stock</span>
          </div>
        </div>

        <div>
          <PeopleIcon />
          <div>
            <strong>Service guidance</strong>
            <span>Packages · Scope · Requests</span>
          </div>
        </div>

        <div>
          <ClockIcon />
          <div>
            <strong>Delivery answers</strong>
            <span>Digital · Timing · Support</span>
          </div>
        </div>

        <div>
          <MessageIcon />
          <div>
            <strong>Need more help?</strong>
            <span>Send a support request</span>
          </div>
        </div>
      </section>

      <section className={styles.popularSection}>
        <div className={styles.popularHeading}>
          <div>
            <span>Start here</span>
            <h2>Most asked</h2>
          </div>

          <p>Quick answers to the questions customers ask most.</p>
        </div>

        <div className={styles.popularGrid}>
          {featuredFAQs.map((faq, index) => (
            <button
              key={faq.id}
              type="button"
              className={styles.popularCard}
              onClick={() => openFeatured(faq)}
            >
              <div className={styles.popularTop}>
                <span>{String(index + 1).padStart(2, "0")}</span>
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
            <span>BirdShop help center</span>
            <h2>Find your answer.</h2>
          </div>

          <p>
            {filteredFAQs.length}{" "}
            {filteredFAQs.length === 1 ? "question" : "questions"}
          </p>
        </div>

        <div className={styles.libraryLayout}>
          <aside className={styles.sidebar}>
            <label className={styles.sidebarSearch}>
              <SearchIcon />

              <input
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search questions"
                aria-label="Search FAQ library"
              />
            </label>

            <div className={styles.categoryBlock}>
              <span>Category</span>

              <div className={styles.categoryList}>
                {faqCategories.map((item) => {
                  const active = category === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      className={active ? styles.categoryActive : ""}
                      aria-pressed={active}
                      onClick={() => changeCategory(item)}
                    >
                      <span>{item}</span>
                      <small>{categoryCount(item)}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.helpCard}>
              <span>Still need help?</span>
              <h3>Talk to BirdShop.</h3>
              <p>
                If the answer is not here, send a support request and
                BirdShop will follow up personally.
              </p>

              <Link href="/contact?topic=general">
                Contact Support
                <ArrowIcon />
              </Link>
            </div>
          </aside>

          <div className={styles.faqArea}>
            <div className={styles.resultBar}>
              <p role="status">
                Showing <strong>{filteredFAQs.length}</strong>{" "}
                {category === ALL_QUESTIONS
                  ? "BirdShop questions"
                  : `questions in ${category}`}
              </p>

              {(search || category !== ALL_QUESTIONS) && (
                <button type="button" onClick={resetFilters}>
                  Clear Filters
                </button>
              )}
            </div>

            {filteredFAQs.length > 0 ? (
              <div className={styles.faqList}>
                {filteredFAQs.map((faq, index) => (
                  <div key={faq.id} id={faq.id} className={styles.faqAnchor}>
                    <FAQRow
                      faq={faq}
                      number={index + 1}
                      open={openItems.has(faq.id)}
                      onToggle={() => toggleFAQ(faq.id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <SearchIcon />
                </div>

                <span>No answers found</span>
                <h3>Nothing matches that search.</h3>
                <p>Try another term or reset the FAQ filters.</p>

                <button type="button" onClick={resetFilters}>
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
          <span>Can&apos;t find your answer?</span>
          <h2>We&apos;re still here.</h2>
          <p>
            Use BirdShop Contact for product help, a service request, general
            support, or to leave a review. Every request gets its own private
            reference, so the conversation can continue later.
          </p>
        </div>

        <div className={styles.contactActions}>
          <Link href="/contact?topic=general">
            <MessageIcon />
            Contact BirdShop
            <ArrowIcon />
          </Link>
        </div>
      </section>

      <section className={styles.quickLinks}>
        <Link href="/products">
          <ShieldIcon />
          <div>
            <span>Digital store</span>
            <strong>Browse Products</strong>
            <p>
              Check pricing, platform, region, availability, and delivery
              information.
            </p>
          </div>
          <ArrowIcon />
        </Link>

        <Link href="/services">
          <PeopleIcon />
          <div>
            <span>Game services</span>
            <strong>Browse Services</strong>
            <p>Choose a package or request a fully custom build.</p>
          </div>
          <ArrowIcon />
        </Link>

        <Link href="/reviews">
          <MessageIcon />
          <div>
            <span>Community</span>
            <strong>Read Reviews</strong>
            <p>Read approved product and service experiences.</p>
          </div>
          <ArrowIcon />
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
