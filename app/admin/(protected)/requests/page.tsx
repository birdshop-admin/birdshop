import Link from "next/link";

import AdminSidebar from "@/components/AdminSidebar";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  assignRequestAdmin,
  permanentlyDeleteRequest,
  restoreRequest,
  setRequestStatus,
  softDeleteRequest,
} from "./actions";

import styles from "../admin-queue.module.css";
import tabStyles from "./SupportTabs.module.css";

export const dynamic =
  "force-dynamic";

type View =
  | "active"
  | "completed"
  | "deleted";

type SupportRequest = {
  id: string;
  reference: string;

  topic:
    | "product"
    | "general";

  status:
    | "open"
    | "in_progress"
    | "resolved"
    | "closed";

  display_name:
    | string
    | null;

  contact_handle:
    string;

  message: string;

  general_subject:
    | string
    | null;

  order_reference:
    | string
    | null;

  product_name:
    | string
    | null;

  product_platform:
    | string
    | null;

  product_region:
    | string
    | null;

  source: string;

  assigned_to:
    | string
    | null;

  assigned_at:
    | string
    | null;

  deleted_at:
    | string
    | null;

  created_at: string;
};

type PageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  ).format(
    new Date(value)
  );
}

function topicLabel(
  topic:
    SupportRequest["topic"]
) {
  return topic ===
    "product"
    ? "Product Help"
    : "General Support";
}

export default async function AdminRequestsPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const view: View =
    params.view ===
      "completed" ||
    params.view ===
      "deleted"
      ? params.view
      : "active";

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "support_requests"
      )
      .select("*")
      .in(
        "topic",
        [
          "product",
          "general",
        ]
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );

  if (error) {
    throw new Error(
      `Unable to load support requests: ${error.message}`
    );
  }

  const requests =
    (
      data ??
      []
    ) as unknown as SupportRequest[];

  const active =
    requests.filter(
      (request) =>
        !request.deleted_at &&
        (
          request.status ===
            "open" ||
          request.status ===
            "in_progress"
        )
    );

  const completed =
    requests.filter(
      (request) =>
        !request.deleted_at &&
        (
          request.status ===
            "resolved" ||
          request.status ===
            "closed"
        )
    );

  const deleted =
    requests.filter(
      (request) =>
        Boolean(
          request.deleted_at
        )
    );

  const visibleRequests =
    view === "completed"
      ? completed
      : view === "deleted"
        ? deleted
        : active;

  return (
    <main
      className={
        styles.page
      }
    >
      <AdminSidebar />

      <section
        className={
          styles.content
        }
      >
        <header
          className={
            styles.header
          }
        >
          <div>
            <span>
              BIRDSHOP / SUPPORT
            </span>

            <h1>
              Support
            </h1>

            <p>
              Product Help and General Support are separated into active conversations, completed tickets, and deleted records.
            </p>
          </div>
        </header>

        {/* =================================================
            STATS
        ================================================= */}

        <section
          className={
            styles.stats
          }
        >
          <article>
            <span>
              ACTIVE
            </span>

            <strong>
              {
                active.length
              }
            </strong>

            <small>
              NEEDS ATTENTION
            </small>
          </article>

          <article>
            <span>
              COMPLETED
            </span>

            <strong>
              {
                completed.length
              }
            </strong>

            <small>
              RESOLVED / CLOSED
            </small>
          </article>

          <article>
            <span>
              DELETED
            </span>

            <strong>
              {
                deleted.length
              }
            </strong>

            <small>
              TRASH
            </small>
          </article>

          <article>
            <span>
              TOTAL
            </span>

            <strong>
              {
                requests.length
              }
            </strong>

            <small>
              ALL SUPPORT RECORDS
            </small>
          </article>
        </section>

        {/* =================================================
            TABS
        ================================================= */}

        <nav
          className={
            tabStyles.tabs
          }
        >
          <Link
            href="/admin/requests?view=active"
            className={
              view ===
              "active"
                ? tabStyles.active
                : ""
            }
          >
            Active

            <span>
              {
                active.length
              }
            </span>
          </Link>

          <Link
            href="/admin/requests?view=completed"
            className={
              view ===
              "completed"
                ? tabStyles.active
                : ""
            }
          >
            Completed

            <span>
              {
                completed.length
              }
            </span>
          </Link>

          <Link
            href="/admin/requests?view=deleted"
            className={
              view ===
              "deleted"
                ? tabStyles.active
                : ""
            }
          >
            Deleted

            <span>
              {
                deleted.length
              }
            </span>
          </Link>
        </nav>

        <div
          className={
            styles.sectionHeading
          }
        >
          <div>
            <span>
              {view ===
              "active"
                ? "SUPPORT INBOX"
                : view ===
                    "completed"
                  ? "FINISHED SUPPORT"
                  : "TRASH"}
            </span>

            <h2>
              {view ===
              "active"
                ? "Customer help."
                : view ===
                    "completed"
                  ? "Completed tickets."
                  : "Deleted tickets."}
            </h2>
          </div>

          <p>
            {view ===
            "active"
              ? "Product questions and general help requiring staff attention appear here."
              : view ===
                  "completed"
                ? "Resolved and closed requests stay here instead of cluttering the active support inbox."
                : "Restore a request or permanently remove it from BirdShop."}
          </p>
        </div>

        {visibleRequests.length ===
        0 ? (
          <div
            className={
              styles.empty
            }
          >
            {view ===
            "active"
              ? "No active Product Help or General Support requests."
              : view ===
                  "completed"
                ? "No completed support requests."
                : "Deleted is empty."}
          </div>
        ) : (
          <div
            className={
              styles.list
            }
          >
            {visibleRequests.map(
              (request) => {
                const selection =
                  request.topic ===
                  "product"
                    ? request.product_name ??
                      "Product Help"
                    : request.general_subject ??
                      "General Support";

                const activeWork =
                  view ===
                    "active";

                return (
                  <article
                    key={
                      request.id
                    }
                    className={
                      styles.card
                    }
                  >
                    <div
                      className={
                        styles.cardTop
                      }
                    >
                      <div>
                        <span>
                          {
                            request.reference
                          }{" "}
                          ·{" "}
                          {topicLabel(
                            request.topic
                          )}
                        </span>

                        <h3>
                          {
                            selection
                          }
                        </h3>

                        <p>
                          {request.display_name ||
                            "Unnamed customer"}{" "}
                          ·{" "}
                          {formatDate(
                            request.created_at
                          )}
                        </p>
                      </div>

                      <div
                        className={
                          styles.status
                        }
                        data-status={
                          request.status
                        }
                      >
                        {request.status.replaceAll(
                          "_",
                          " "
                        )}
                      </div>
                    </div>

                    <div
                      className={
                        styles.body
                      }
                    >
                      <p
                        className={
                          styles.message
                        }
                      >
                        {
                          request.message
                        }
                      </p>

                      <div
                        className={
                          styles.meta
                        }
                      >
                        <div>
                          <span>
                            CONTACT
                          </span>

                          <strong>
                            {
                              request.contact_handle
                            }
                          </strong>
                        </div>

                        {request.order_reference && (
                          <div>
                            <span>
                              ORDER / REFERENCE
                            </span>

                            <strong>
                              {
                                request.order_reference
                              }
                            </strong>
                          </div>
                        )}

                        {request.topic ===
                          "product" && (
                          <>
                            <div>
                              <span>
                                PRODUCT
                              </span>

                              <strong>
                                {request.product_name ??
                                  "—"}
                              </strong>
                            </div>

                            <div>
                              <span>
                                PLATFORM / REGION
                              </span>

                              <strong>
                                {request.product_platform ??
                                  "—"}{" "}
                                ·{" "}
                                {request.product_region ??
                                  "—"}
                              </strong>
                            </div>
                          </>
                        )}

                        <div>
                          <span>
                            ASSIGNED ADMIN
                          </span>

                          <strong>
                            {request.assigned_to ||
                              "Unassigned"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* =====================================
                        ACTIVE CONTROLS
                    ===================================== */}

                    {activeWork && (
                      <>
                        <div
                          className={
                            styles.assignment
                          }
                        >
                          <div>
                            <span
                              className={
                                styles.fieldLabel
                              }
                            >
                              WORKING ON THIS
                            </span>

                            <p>
                              Assign the admin responsible for this conversation.
                            </p>
                          </div>

                          <form
                            action={
                              assignRequestAdmin
                            }
                            className={
                              styles.assignmentForm
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                request.id
                              }
                            />

                            <input
                              className={
                                styles.assignmentInput
                              }
                              name="assigned_to"
                              defaultValue={
                                request.assigned_to ??
                                ""
                              }
                              placeholder="Admin username"
                              minLength={2}
                              maxLength={80}
                              required
                            />

                            <button
                              className={
                                styles.assignmentButton
                              }
                            >
                              {request.status ===
                              "open"
                                ? "Assign & Start"
                                : "Update Admin"}
                            </button>
                          </form>
                        </div>

                        <div
                          className={
                            styles.actions
                          }
                        >
                          {request.status ===
                            "in_progress" && (
                            <form
                              action={
                                setRequestStatus
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  request.id
                                }
                              />

                              <button
                                name="status"
                                value="open"
                              >
                                Reopen
                              </button>
                            </form>
                          )}

                          <form
                            action={
                              setRequestStatus
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                request.id
                              }
                            />

                            <button
                              name="status"
                              value="resolved"
                              className={
                                styles.primary
                              }
                            >
                              Resolve
                            </button>
                          </form>

                          <form
                            action={
                              softDeleteRequest
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                request.id
                              }
                            />

                            <button
                              className={
                                styles.danger
                              }
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </>
                    )}

                    {/* =====================================
                        COMPLETED CONTROLS
                    ===================================== */}

                    {view ===
                      "completed" && (
                      <div
                        className={
                          styles.actions
                        }
                      >
                        <form
                          action={
                            setRequestStatus
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              request.id
                            }
                          />

                          <button
                            name="status"
                            value="open"
                          >
                            Reopen
                          </button>
                        </form>

                        {request.status ===
                          "resolved" && (
                          <form
                            action={
                              setRequestStatus
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                request.id
                              }
                            />

                            <button
                              name="status"
                              value="closed"
                            >
                              Close
                            </button>
                          </form>
                        )}

                        <form
                          action={
                            softDeleteRequest
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              request.id
                            }
                          />

                          <button
                            className={
                              styles.danger
                            }
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    )}

                    {/* =====================================
                        DELETED CONTROLS
                    ===================================== */}

                    {view ===
                      "deleted" && (
                      <div
                        className={
                          styles.actions
                        }
                      >
                        <form
                          action={
                            restoreRequest
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              request.id
                            }
                          />

                          <button
                            className={
                              styles.primary
                            }
                          >
                            Restore
                          </button>
                        </form>

                        <form
                          action={
                            permanentlyDeleteRequest
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              request.id
                            }
                          />

                          <button
                            className={
                              styles.danger
                            }
                          >
                            Permanently Delete
                          </button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}