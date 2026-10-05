import SubmitButton from "@/components/SubmitButton";
import { requireOwner } from "@/lib/staff-auth";
import AdminSidebar from "@/components/AdminSidebar";

import { createClient } from "@/lib/supabase/server";

import {
  assignReviewAdmin,
  deleteReview,
  setReviewStatus,
  toggleReviewFeatured,
} from "./actions";

import styles from "../admin-queue.module.css";

export const dynamic = "force-dynamic";

type AdminReview = {
  id: string;

  reference: string;

  status: "pending" | "approved" | "rejected";

  type: "Product" | "Service";

  reviewer: string;

  initials: string;

  contact_handle: string;

  rating: number;

  title: string;

  body: string;

  subject: string;

  meta: string;

  featured: boolean;

  assigned_to: string | null;

  assigned_at: string | null;

  created_at: string;
};

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(new Date(value));
}

/* =========================================================
   REVIEWS PAGE
========================================================= */

export default async function AdminReviewsPage() {
  await requireOwner();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Unable to load reviews: Please retry or contact the owner.`,
    );
  }

  const reviews = (data ?? []) as unknown as AdminReview[];

  /* =======================================================
     STATS
  ======================================================= */

  const pending = reviews.filter(
    (review) => review.status === "pending",
  ).length;

  const approved = reviews.filter(
    (review) => review.status === "approved",
  ).length;

  const rejected = reviews.filter(
    (review) => review.status === "rejected",
  ).length;

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main className={styles.page}>
      <AdminSidebar />

      <section className={styles.content}>
        {/* =================================================
            HEADER
        ================================================= */}

        <header className={styles.header}>
          <div>
            <span>BIRDSHOP / ADMIN</span>

            <h1>Reviews</h1>

            <p>
              Moderate customer submissions before they appear on the public
              Reviews page.
            </p>
          </div>
        </header>

        {/* =================================================
            STATS
        ================================================= */}

        <section className={styles.stats}>
          <article>
            <span>TOTAL</span>

            <strong>{reviews.length}</strong>

            <small>SUBMISSIONS</small>
          </article>

          <article>
            <span>PENDING</span>

            <strong>{pending}</strong>

            <small>NEEDS REVIEW</small>
          </article>

          <article>
            <span>APPROVED</span>

            <strong>{approved}</strong>

            <small>PUBLIC FEED</small>
          </article>

          <article>
            <span>REJECTED</span>

            <strong>{rejected}</strong>

            <small>NOT PUBLIC</small>
          </article>
        </section>

        {/* =================================================
            SECTION HEADING
        ================================================= */}

        <div className={styles.sectionHeading}>
          <div>
            <span>MODERATION QUEUE</span>

            <h2>Customer reviews.</h2>
          </div>

          <p>
            Pending reviews can be assigned to an admin. Approved reviews become
            eligible for the public community page.
          </p>
        </div>

        {/* =================================================
            EMPTY STATE
        ================================================= */}

        {reviews.length === 0 ? (
          <div className={styles.empty}>No review submissions yet.</div>
        ) : (
          /* ===============================================
             REVIEW LIST
          =============================================== */

          <div className={styles.list}>
            {reviews.map((review) => (
              <article key={review.id} className={styles.card}>
                {/* =======================================
                      TOP
                  ======================================= */}

                <div className={styles.cardTop}>
                  <div>
                    <span>
                      {review.reference} · {review.type} · {review.rating}
                      /5
                    </span>

                    <h3>{review.title}</h3>

                    <p>
                      {review.reviewer} · {formatDate(review.created_at)}
                    </p>
                  </div>

                  <div className={styles.status} data-status={review.status}>
                    {review.status}
                  </div>
                </div>

                {/* =======================================
                      BODY
                  ======================================= */}

                <div className={styles.body}>
                  <p className={styles.message}>{review.body}</p>

                  <div className={styles.meta}>
                    <div>
                      <span>REVIEWING</span>

                      <strong>{review.subject}</strong>
                    </div>

                    <div>
                      <span>DETAILS</span>

                      <strong>{review.meta || "—"}</strong>
                    </div>

                    <div>
                      <span>CONTACT</span>

                      <strong>{review.contact_handle}</strong>
                    </div>

                    <div>
                      <span>ASSIGNED ADMIN</span>

                      <strong>{review.assigned_to || "Unassigned"}</strong>
                    </div>

                    <div>
                      <span>FEATURED</span>

                      <strong>{review.featured ? "Yes" : "No"}</strong>
                    </div>
                  </div>
                </div>

                {/* =======================================
                      MODERATION ASSIGNMENT
                  ======================================= */}

                {review.status === "pending" && (
                  <div className={styles.assignment}>
                    <div>
                      <span className={styles.fieldLabel}>
                        MODERATION OWNER
                      </span>

                      <p>
                        Type the admin username or display name handling this
                        review.
                      </p>
                    </div>

                    <form
                      action={assignReviewAdmin}
                      className={styles.assignmentForm}
                    >
                      <input type="hidden" name="id" value={review.id} />

                      <input
                        className={styles.assignmentInput}
                        type="text"
                        name="assigned_to"
                        defaultValue={review.assigned_to ?? ""}
                        placeholder="Admin username"
                        minLength={2}
                        maxLength={80}
                        required
                      />

                      <SubmitButton
                        type="submit"
                        className={styles.assignmentButton}
                      >
                        {review.assigned_to ? "Update Admin" : "Assign Admin"}
                      </SubmitButton>
                    </form>
                  </div>
                )}

                {/* =======================================
                      COMPLETED MODERATION OWNER
                  ======================================= */}

                {review.status !== "pending" && review.assigned_to && (
                  <div className={styles.settledNote}>
                    <span>MODERATED BY</span>

                    <strong>{review.assigned_to}</strong>
                  </div>
                )}

                {/* =======================================
                      ACTIONS
                  ======================================= */}

                <div className={styles.actions}>
                  {/* PENDING */}

                  {review.status === "pending" && (
                    <>
                      <form action={setReviewStatus}>
                        <input type="hidden" name="id" value={review.id} />

                        <SubmitButton
                          type="submit"
                          name="status"
                          value="approved"
                          className={styles.primary}
                        >
                          Approve
                        </SubmitButton>
                      </form>

                      <form action={setReviewStatus}>
                        <input type="hidden" name="id" value={review.id} />

                        <SubmitButton
                          type="submit"
                          name="status"
                          value="rejected"
                        >
                          Reject
                        </SubmitButton>
                      </form>
                    </>
                  )}

                  {/* APPROVED */}

                  {review.status === "approved" && (
                    <form action={toggleReviewFeatured}>
                      <input type="hidden" name="id" value={review.id} />

                      <input
                        type="hidden"
                        name="featured"
                        value={String(review.featured)}
                      />

                      <SubmitButton type="submit">
                        {review.featured ? "Remove Featured" : "Feature Review"}
                      </SubmitButton>
                    </form>
                  )}

                  {/* REJECTED */}

                  {review.status === "rejected" && (
                    <form action={setReviewStatus}>
                      <input type="hidden" name="id" value={review.id} />

                      <SubmitButton type="submit" name="status" value="pending">
                        Return to Pending
                      </SubmitButton>
                    </form>
                  )}

                  {/* DELETE */}

                  <form action={deleteReview}>
                    <input type="hidden" name="id" value={review.id} />

                    <SubmitButton type="submit" className={styles.danger}>
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
