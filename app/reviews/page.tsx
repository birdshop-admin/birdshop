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
const FEED_ERROR =
  "The review feed is temporarily unavailable. Please refresh in a moment.";

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

function Stars({
  rating,
  decorative = false,
}: {
  rating: number;
  /** Hide from assistive tech when nearby text already states the rating. */
  decorative?: boolean;
}) {
  return (
    <div
      className={styles.stars}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": `${rating} out of 5 stars` })}
    >
      {Array.from({ length: 5 }).map((_, index) => (
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
  const bodyId = `review-${review.id}-body`;

  return (
    <article className={styles.reviewCard}>
      <div className={styles.reviewCardTop}>
        <div className={styles.reviewIdentity}>
          <div className={styles.reviewAvatar} aria-hidden="true">
            {review.initials}
          </div>

          <div>
            <strong>{review.reviewer}</strong>

            <span>Community review</span>
          </div>
        </div>

        <div className={styles.reviewDate}>{review.date}</div>
      </div>

      <div className={styles.reviewRatingRow}>
        <Stars rating={review.rating} />
        <span aria-hidden="true">{review.rating}.0</span>
      </div>

      <h3>{review.title}</h3>

      <p
        id={bodyId}
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
          aria-expanded={expanded}
          aria-controls={bodyId}
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
          <span>Details</span>
          <strong>{review.meta}</strong>
        </div>
      </div>
    </article>
  );
}

/* Same footprint as a review card while the feed loads. */
function ReviewCardSkeleton() {
  return (
    <div
      className={`${styles.reviewCard} ${styles.skeletonCard}`}
      aria-hidden="true"
    >
      <div className={styles.skeletonIdentity}>
        <span className={`${styles.skeleton} ${styles.skeletonAvatar}`} />

        <div>
          <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonName}`} />
          <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonShort}`} />
        </div>
      </div>

      <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
      <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
      <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
      <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonMid}`} />
    </div>
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
  // Bumped by Try Again; the effect refetches when it changes.
  const [reloadKey, setReloadKey] = useState(0);

  const [filter, setFilter] = useState<ReviewFilter>("All Reviews");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(
    () => new Set(),
  );

  // Every state update here happens after the request resolves; the initial
  // state already reads "loading", so nothing is set synchronously.
  useEffect(() => {
    let active = true;

    async function loadReviews() {
      try {
        const { data, error } = await supabase.rpc("get_approved_reviews");

        if (!active) return;
        if (error) throw error;

        setApprovedReviews(
          ((data ?? []) as unknown as DatabaseReview[]).map(mapDatabaseReview),
        );
        setLoadError(null);
      } catch {
        if (!active) return;

        setApprovedReviews([]);
        setLoadError(FEED_ERROR);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReviews();

    return () => {
      active = false;
    };
  }, [supabase, reloadKey]);

  function retryReviews() {
    setLoading(true);
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }

  const featuredReview =
    approvedReviews.find((review) => review.featured) ?? approvedReviews[0];

  const filteredReviews = useMemo(() => {
    if (filter === "Products") {
      return approvedReviews.filter((review) => review.type === "Product");
    }

    if (filter === "Services") {
      return approvedReviews.filter((review) => review.type === "Service");
    }

    return approvedReviews;
  }, [filter, approvedReviews]);

  // Aggregate rating from the approved reviews actually loaded; hidden at 0.
  const ratingSummary = useMemo(() => {
    const ratings = approvedReviews
      .map((review) => Number(review.rating))
      .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);

    if (ratings.length === 0) return null;

    return {
      average: ratings.reduce((total, rating) => total + rating, 0) / ratings.length,
      count: ratings.length,
    };
  }, [approvedReviews]);

  const displayedReviews = filteredReviews.slice(0, visibleCount);

  const hasMore = visibleCount < filteredReviews.length;

  const productCount = approvedReviews.filter(
    (review) => review.type === "Product",
  ).length;

  const serviceCount = approvedReviews.filter(
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
            <p className={styles.eyebrow}>BirdShop / Community</p>

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

          <div className={styles.heroEditorial} aria-hidden="true">
            <div className={styles.heroMark}>
              <span>BS</span>
              <div />
              <strong>Community</strong>
              <small>
                Experiences
                <br />
                worth sharing
              </small>
            </div>

            <div className={styles.heroSideCopy}>
              <span>Real</span>
              <span>Simple</span>
              <span>Clear</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.communityStrip}>
        <div>
          <MessageIcon />
          <div>
            <strong>Clear feedback</strong>
            <span>Product &amp; service experiences</span>
          </div>
        </div>

        <div>
          <PeopleIcon />
          <div>
            <strong>Community led</strong>
            <span>Approved customer submissions</span>
          </div>
        </div>

        <div>
          <ShieldIcon />
          <div>
            <strong>Moderated</strong>
            <span>Checked before publishing</span>
          </div>
        </div>

        <div>
          <HeartIcon />
          <div>
            <strong>More than sales</strong>
            <span>Community comes first</span>
          </div>
        </div>
      </section>

      {/* Holds the featured slot while loading, so the page does not jump. */}
      {loading && (
        <section className={styles.featuredSection} aria-hidden="true">
          <div className={styles.featuredHeading}>
            <div>
              <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonEyebrow}`} />
              <span className={`${styles.skeleton} ${styles.skeletonHeading}`} />
            </div>
          </div>

          <div className={`${styles.skeleton} ${styles.featuredSkeleton}`} />
        </section>
      )}

      {!loading && featuredReview && (
        <section className={styles.featuredSection}>
          <div className={styles.featuredHeading}>
            <div>
              <span>Featured experience</span>
              <h2>From the community.</h2>
            </div>

            <p>A closer look at one BirdShop experience.</p>
          </div>

          <article className={styles.featuredReview}>
            <div className={styles.featuredDark}>
              <div className={styles.featuredQuoteMark} aria-hidden="true">
                “
              </div>

              <Stars rating={featuredReview.rating} />

              <blockquote>{featuredReview.title}</blockquote>

              <p>{featuredReview.body}</p>

              <span className={styles.sampleNotice}>
                Approved community review
              </span>
            </div>

            <div className={styles.featuredDetails}>
              <div className={styles.featuredPerson}>
                <div aria-hidden="true">{featuredReview.initials}</div>

                <span>
                  <strong>{featuredReview.reviewer}</strong>
                  <small>{featuredReview.date}</small>
                </span>
              </div>

              <div className={styles.featuredMeta}>
                <div>
                  <span>Experience</span>
                  <strong>{featuredReview.type}</strong>
                </div>

                <div>
                  <span>Reviewed</span>
                  <strong>{featuredReview.subject}</strong>
                </div>

                <div>
                  <span>Details</span>
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
            <span>Community reviews</span>
            <h2>Recent experiences</h2>
          </div>

          <p>
            {loading
              ? "Loading…"
              : `${filteredReviews.length} ${
                  filteredReviews.length === 1 ? "review" : "reviews"
                }`}
          </p>
        </div>

        <div className={styles.filters}>
          {reviewTypes.map((item) => {
            const count =
              item === "Products"
                ? productCount
                : item === "Services"
                  ? serviceCount
                  : approvedReviews.length;

            const active = filter === item;

            return (
              <button
                key={item}
                type="button"
                className={active ? styles.activeFilter : ""}
                aria-pressed={active}
                onClick={() => changeFilter(item)}
              >
                <span>{item}</span>
                <small>{loading ? "—" : count}</small>
              </button>
            );
          })}
        </div>

        <div className={styles.communityBanner}>
          <div className={styles.communityIcon}>
            <CheckIcon />
          </div>

          <div>
            {!loading && !loadError && ratingSummary ? (
              <div className={styles.ratingSummary}>
                <Stars rating={Math.round(ratingSummary.average)} decorative />

                <strong>
                  {ratingSummary.average.toFixed(1)} average ·{" "}
                  {ratingSummary.count} approved{" "}
                  {ratingSummary.count === 1 ? "review" : "reviews"}
                </strong>
              </div>
            ) : (
              <strong>
                {loading
                  ? "Loading community reviews"
                  : loadError
                    ? "Unable to load community reviews"
                    : "Moderated community feed"}
              </strong>
            )}

            <p>
              {loadError
                ? FEED_ERROR
                : "Only reviews approved by BirdShop moderation appear here. Contact details are never included in the public review feed."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className={styles.reviewGrid} aria-busy="true">
            <p className="visually-hidden" role="status">
              Loading reviews…
            </p>

            {[0, 1, 2].map((card) => (
              <ReviewCardSkeleton key={card} />
            ))}
          </div>
        ) : displayedReviews.length > 0 ? (
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
                  <span aria-hidden="true">↓</span>
                </button>
              ) : (
                <div className={styles.allShown}>
                  <CheckIcon />
                  All reviews shown
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            className={styles.reviewEmpty}
            role={loadError ? "alert" : undefined}
          >
            <span>
              {loadError ? "Review feed unavailable" : "No approved reviews yet"}
            </span>

            <h3>
              {loadError
                ? "We could not load reviews right now."
                : "Be the first to share an experience."}
            </h3>

            <p>
              {loadError
                ? "Nothing about your own submission has changed. Please try again in a moment."
                : "New submissions stay private until a BirdShop admin approves them."}
            </p>

            {loadError ? (
              <button type="button" onClick={retryReviews}>
                Try Again
              </button>
            ) : (
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
          <span>Your experience matters</span>

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
          <h3>Useful feedback</h3>
          <p>Positive or negative, specific feedback helps BirdShop improve.</p>
        </div>

        <div>
          <ShieldIcon />
          <h3>Moderated publishing</h3>
          <p>
            Reviews are checked before publishing while the customer&apos;s
            written feedback remains intact.
          </p>
        </div>

        <div>
          <PeopleIcon />
          <h3>Community first</h3>
          <p>BirdShop is built around people, not just transactions.</p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
