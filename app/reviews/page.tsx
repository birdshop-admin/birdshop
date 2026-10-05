"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import {
  ArrowIcon,
  CheckIcon,
  HeartIcon,
  MessageIcon,
  PeopleIcon,
  ShieldIcon,
} from "@/components/SiteIcons";

import { reviewTypes, type Review, type ReviewFilter } from "@/lib/reviews";

import { createClient } from "@/lib/supabase/client";

import styles from "./reviews.module.css";

const INITIAL_VISIBLE = 6;
const LOAD_MORE_AMOUNT = 4;

type DatabaseReview = {
  id: string;
  type: "Product" | "Service";
  reviewer: string;
  initials: string;
  rating: number;
  title: string;
  body: string;
  subject: string;
  meta: string;
  featured: boolean;
  created_at: string;
};

function formatReviewDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function mapDatabaseReview(review: DatabaseReview): Review {
  return {
    id: review.id,
    type: review.type,
    reviewer: review.reviewer,
    initials: review.initials || "AN",
    rating: review.rating,
    title: review.title,
    body: review.body,
    subject: review.subject,
    meta:
      review.meta ||
      (review.type === "Product" ? "Digital Product" : "Service Experience"),
    featured: review.featured,
    date: formatReviewDate(review.created_at),
  };
}

/* =========================================================
   STARS
========================================================= */

function Stars({ rating }: { rating: number }) {
  return (
    <div className={styles.stars} aria-label={`${rating} out of 5 stars`}>
      {Array.from({
        length: 5,
      }).map((_, index) => (
        <span
          key={index}
          className={index < rating ? styles.starActive : styles.starEmpty}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
}

/* =========================================================
   REVIEW CARD
========================================================= */

function ReviewCard({
  review,
  expanded,
  onToggle,
}: {
  review: Review;
  expanded: boolean;
  onToggle: () => void;
}) {
  const longReview = review.body.length > 185;

  return (
    <article className={styles.reviewCard}>
      <div className={styles.reviewCardTop}>
        <div className={styles.reviewIdentity}>
          <div className={styles.reviewAvatar}>{review.initials}</div>

          <div>
            <strong>{review.reviewer}</strong>

            <span>COMMUNITY REVIEW</span>
          </div>
        </div>

        <div className={styles.reviewDate}>{review.date}</div>
      </div>

      <div className={styles.reviewRatingRow}>
        <Stars rating={review.rating} />
        <span>{review.rating}.0</span>
      </div>

      <h3>{review.title}</h3>

      <p
        className={`${styles.reviewBody} ${
          !expanded && longReview ? styles.reviewBodyCollapsed : ""
        }`}
      >
        {review.body}
      </p>

      {longReview && (
        <button
          type="button"
          className={styles.readMoreButton}
          onClick={onToggle}
        >
          {expanded ? "Show Less" : "Read Full Review"}

          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
      )}

      <div className={styles.reviewSubject}>
        <div>
          <span>{review.type}</span>
          <strong>{review.subject}</strong>
        </div>

        <div>
          <span>DETAILS</span>
          <strong>{review.meta}</strong>
        </div>
      </div>
    </article>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function ReviewsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [approvedReviews, setApprovedReviews] = useState<Review[]>([]);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [filter, setFilter] = useState<ReviewFilter>("All Reviews");

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      setLoading(true);
      setLoadError(null);

      const { data, error } = await supabase.rpc("get_approved_reviews");

      if (!active) {
        return;
      }

      if (error) {
        setLoadError("Reviews could not load. Please refresh and retry.");
        setApprovedReviews([]);
        setLoading(false);
        return;
      }

      const mapped = ((data ?? []) as unknown as DatabaseReview[]).map(
        mapDatabaseReview,
      );

      setApprovedReviews(mapped);
      setLoading(false);
    }

    void loadReviews();

    return () => {
      active = false;
    };
  }, [supabase]);

  const allReviews = approvedReviews;

  const featuredReview =
    approvedReviews.find((review) => review.featured) ?? approvedReviews[0];

  const filteredReviews = useMemo(() => {
    if (filter === "Products") {
      return allReviews.filter((review) => review.type === "Product");
    }

    if (filter === "Services") {
      return allReviews.filter((review) => review.type === "Service");
    }

    return allReviews;
  }, [filter, allReviews]);

  const displayedReviews = filteredReviews.slice(0, visibleCount);

  const hasMore = visibleCount < filteredReviews.length;

  const productCount = allReviews.filter(
    (review) => review.type === "Product",
  ).length;

  const serviceCount = allReviews.filter(
    (review) => review.type === "Service",
  ).length;

  function changeFilter(nextFilter: ReviewFilter) {
    setFilter(nextFilter);
    setVisibleCount(INITIAL_VISIBLE);
  }

  function toggleReview(id: string) {
    setExpandedReviews((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  return (
    <main className="page-shell">
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>BIRDSHOP / COMMUNITY</p>

            <h1>
              What people
              <br />
              say.
            </h1>

            <p className={styles.heroDescription}>
              Product experiences, service feedback, and stories from the
              BirdShop community — presented clearly and without the noise.
            </p>

            <div className={styles.heroActions}>
              <a href="#reviews" className={styles.heroPrimary}>
                Browse Reviews
                <ArrowIcon />
              </a>

              <Link
                href="/contact?topic=review"
                className={styles.heroSecondary}
              >
                Leave a Review
              </Link>
            </div>
          </div>

          <div className={styles.heroEditorial}>
            <div className={styles.heroMark}>
              <span>BS</span>
              <div />
              <strong>COMMUNITY</strong>
              <small>
                EXPERIENCES
                <br />
                WORTH SHARING
              </small>
            </div>

            <div className={styles.heroSideCopy}>
              <span>REAL</span>
              <span>SIMPLE</span>
              <span>CLEAR</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.communityStrip}>
        <div>
          <MessageIcon />
          <div>
            <strong>Clear Feedback</strong>
            <span>PRODUCT & SERVICE EXPERIENCES</span>
          </div>
        </div>

        <div>
          <PeopleIcon />
          <div>
            <strong>Community Led</strong>
            <span>APPROVED CUSTOMER SUBMISSIONS</span>
          </div>
        </div>

        <div>
          <ShieldIcon />
          <div>
            <strong>Moderated</strong>
            <span>REVIEWS CHECKED BEFORE PUBLISHING</span>
          </div>
        </div>

        <div>
          <HeartIcon />
          <div>
            <strong>More Than Sales</strong>
            <span>COMMUNITY COMES FIRST</span>
          </div>
        </div>
      </section>

      {featuredReview && (
        <section className={styles.featuredSection}>
          <div className={styles.featuredHeading}>
            <div>
              <span>FEATURED EXPERIENCE</span>
              <h2>From the community.</h2>
            </div>

            <p>A closer look at one BirdShop experience.</p>
          </div>

          <article className={styles.featuredReview}>
            <div className={styles.featuredDark}>
              <div className={styles.featuredQuoteMark}>“</div>

              <Stars rating={featuredReview.rating} />

              <blockquote>{featuredReview.title}</blockquote>

              <p>{featuredReview.body}</p>

              <span className={styles.sampleNotice}>
                APPROVED COMMUNITY REVIEW
              </span>
            </div>

            <div className={styles.featuredDetails}>
              <div className={styles.featuredPerson}>
                <div>{featuredReview.initials}</div>

                <span>
                  <strong>{featuredReview.reviewer}</strong>
                  <small>{featuredReview.date}</small>
                </span>
              </div>

              <div className={styles.featuredMeta}>
                <div>
                  <span>EXPERIENCE</span>
                  <strong>{featuredReview.type}</strong>
                </div>

                <div>
                  <span>REVIEWED</span>
                  <strong>{featuredReview.subject}</strong>
                </div>

                <div>
                  <span>DETAILS</span>
                  <strong>{featuredReview.meta}</strong>
                </div>
              </div>

              <Link
                href={
                  featuredReview.type === "Service" ? "/services" : "/products"
                }
                className={styles.featuredLink}
              >
                Browse{" "}
                {featuredReview.type === "Service" ? "Services" : "Products"}
                <ArrowIcon />
              </Link>
            </div>
          </article>
        </section>
      )}

      <section id="reviews" className={styles.reviewSection}>
        <div className={styles.reviewHeading}>
          <div>
            <span>COMMUNITY REVIEWS</span>
            <h2>Recent Experiences</h2>
          </div>

          <p>
            {filteredReviews.length}{" "}
            {filteredReviews.length === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className={styles.filters}>
          {reviewTypes.map((item) => {
            let count = allReviews.length;

            if (item === "Products") {
              count = productCount;
            }

            if (item === "Services") {
              count = serviceCount;
            }

            return (
              <button
                key={item}
                type="button"
                className={filter === item ? styles.activeFilter : ""}
                onClick={() => changeFilter(item)}
              >
                <span>{item}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </div>

        <div className={styles.communityBanner}>
          <div className={styles.communityIcon}>
            <CheckIcon />
          </div>

          <div>
            <strong>
              {loading
                ? "Loading community reviews"
                : loadError
                  ? "Unable to load community reviews"
                  : approvedReviews.length > 0
                    ? `${approvedReviews.length} approved community ${approvedReviews.length === 1 ? "review" : "reviews"}`
                    : "No approved reviews yet"}
            </strong>

            <p>
              {loadError
                ? "The review feed could not be loaded. No sample or filler reviews are shown as a fallback."
                : "Only reviews approved by BirdShop moderation appear here. Contact details are never included in the public review feed."}
            </p>
          </div>
        </div>

        {displayedReviews.length > 0 ? (
          <>
            <div className={styles.reviewGrid}>
              {displayedReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  expanded={expandedReviews.has(review.id)}
                  onToggle={() => toggleReview(review.id)}
                />
              ))}
            </div>

            <div className={styles.loadMoreArea}>
              <p>
                Showing <strong>{displayedReviews.length}</strong> of{" "}
                <strong>{filteredReviews.length}</strong> reviews
              </p>

              {hasMore ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((current) =>
                      Math.min(
                        current + LOAD_MORE_AMOUNT,
                        filteredReviews.length,
                      ),
                    )
                  }
                >
                  Show More Reviews
                  <span>↓</span>
                </button>
              ) : (
                <div className={styles.allShown}>
                  <CheckIcon />
                  All Reviews Shown
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.reviewEmpty}>
            <span>
              {loadError
                ? "REVIEW FEED UNAVAILABLE"
                : "NO APPROVED REVIEWS YET"}
            </span>

            <h3>
              {loadError
                ? "We could not load reviews right now."
                : "Be the first to share an experience."}
            </h3>

            <p>
              {loadError
                ? "Try refreshing the page in a moment."
                : "New submissions stay private until a BirdShop admin approves them."}
            </p>

            {!loadError && (
              <Link href="/contact?topic=review">
                Leave a Review
                <ArrowIcon />
              </Link>
            )}
          </div>
        )}
      </section>

      <section className={styles.feedbackCta}>
        <div className={styles.feedbackOverlay} />

        <div className={styles.feedbackCopy}>
          <span>YOUR EXPERIENCE MATTERS</span>

          <h2>
            Have something
            <br />
            to share?
          </h2>

          <p>
            Purchased a product or completed a BirdShop service? Submit a rating
            and written review. New reviews enter moderation before they can
            appear publicly.
          </p>
        </div>

        <div className={styles.feedbackActions}>
          <Link href="/contact?topic=review">
            Leave a Review
            <ArrowIcon />
          </Link>

          <small>
            Your contact information is used for follow-up and is never shown
            publicly with the review.
          </small>
        </div>
      </section>

      <section className={styles.values}>
        <div>
          <MessageIcon />
          <h3>Useful Feedback</h3>
          <p>Positive or negative, specific feedback helps BirdShop improve.</p>
        </div>

        <div>
          <ShieldIcon />
          <h3>Moderated Publishing</h3>
          <p>
            Reviews are checked before publishing while the customer&apos;s
            written feedback remains intact.
          </p>
        </div>

        <div>
          <PeopleIcon />
          <h3>Community First</h3>
          <p>BirdShop is built around people, not just transactions.</p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
