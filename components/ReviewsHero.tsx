"use client";

import Link from "next/link";
import { useRef } from "react";

import type { Review } from "@/lib/reviews";
import CosmicReviewsScene from "./CosmicReviewsScene";
import { ArrowIcon, CheckIcon, PeopleIcon } from "./SiteIcons";
import styles from "./ReviewsHero.module.css";

type Props = {
  reviews: Review[];
  loading: boolean;
  error: boolean;
  summary: { average: number; count: number } | null;
  onRevealReview?: (id: string) => void;
};

export default function ReviewsHero({ reviews, loading, error, summary, onRevealReview }: Props) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const heroReviews = reviews.slice(0, 6);

  function moveReviews(direction: number) {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const card = carousel.querySelector("article");
    carousel.scrollBy({
      left: direction * ((card?.getBoundingClientRect().width ?? carousel.clientWidth) + 22),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  return (
    <section className={styles.hero} aria-labelledby="bs-reviews-title">
      <CosmicReviewsScene />
      <div className={styles.copy}>
        <p className={styles.eyebrow}>BIRDSHOP COMMUNITY</p>
        <h1 id="bs-reviews-title">Reviews</h1>
        <p className={styles.description}>Real feedback from real customers.</p>
        <div className={styles.actions}>
          <Link href="#reviews" className={styles.primary}>VIEW REVIEWS <ArrowIcon className={styles.diagonalArrow} /></Link>
          <Link href="/contact?topic=review">LEAVE A REVIEW <ArrowIcon className={styles.diagonalArrow} /></Link>
        </div>
        {!loading && !error && summary && (
          <dl className={styles.summary} data-review-summary>
            <div>
              <span className={styles.ratingIcon} aria-hidden="true">☆</span>
              <dt>COMMUNITY RATING</dt>
              <dd>{summary.average.toFixed(1)} <small>/ 5</small></dd>
            </div>
            <div>
              <PeopleIcon />
              <dt>APPROVED {summary.count === 1 ? "REVIEW" : "REVIEWS"}</dt>
              <dd>{summary.count.toLocaleString("en-US")}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className={styles.stories}>
        {loading ? (
          <div className={styles.feedStatus} role="status" data-review-hero-state="loading">
            <span className={styles.statusDot} /> Loading community experiences…
          </div>
        ) : !error && heroReviews.length ? (
          <div className={styles.carouselWrap}>
            {heroReviews.length > 1 && <button className={styles.previous} type="button" aria-label="Previous community review" onClick={() => moveReviews(-1)}><ArrowIcon /></button>}
            <div ref={carouselRef} className={styles.carousel} aria-label="Approved community experiences" tabIndex={0}>
              {heroReviews.map(review => (
                <article className={styles.story} key={review.id} data-review-hero-card>
                  <div className={styles.identity}>
                    <span className={styles.avatar} aria-hidden="true">{review.initials}</span>
                    <div><strong>{review.reviewer}</strong><time>{review.date}</time></div>
                  </div>
                  <p className={styles.stars} role="img" aria-label={`${review.rating} out of 5 stars`}>
                    <span aria-hidden="true">{"★".repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}<span className={styles.emptyStars}>{"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(review.rating))))}</span></span>
                  </p>
                  <blockquote>“{review.body}”</blockquote>
                  <a href={`#review-${review.id}`} className={styles.readReview} onClick={() => onRevealReview?.(review.id)}>Read review <ArrowIcon className={styles.diagonalArrow} /></a>
                </article>
              ))}
            </div>
            {heroReviews.length > 1 && <button className={styles.next} type="button" aria-label="Next community review" onClick={() => moveReviews(1)}><ArrowIcon /></button>}
          </div>
        ) : (
          <div className={styles.feedStatus} data-review-hero-state={error ? "error" : "empty"}>
            <CheckIcon />
            <div><strong>{error ? "Community feed temporarily unavailable" : "Community stories start here."}</strong>
              <span>{error ? "You can retry the review feed below." : "Approved customer experiences will appear here."}</span></div>
          </div>
        )}
      </div>
    </section>
  );
}
