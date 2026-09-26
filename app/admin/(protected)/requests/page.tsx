import AdminSidebar from "@/components/AdminSidebar";

import {
  createClient,
} from "@/lib/supabase/server";

import styles from "../admin-queue.module.css";

export const dynamic =
  "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type SupportRequest = {
  id: string;

  reference: string;

  topic:
    | "service"
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

  message:
    string;

  general_subject:
    | string
    | null;

  order_reference:
    | string
    | null;

  service_name:
    | string
    | null;

  package_name:
    | string
    | null;

  package_price:
    | number
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

  source:
    string;

  assigned_to:
    | string
    | null;

  assigned_at:
    | string
    | null;

  created_at:
    string;
};

/* =========================================================
   HELPERS
========================================================= */

function formatDate(
  value:
    string
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
    new Date(
      value
    )
  );
}

function topicLabel(
  topic:
    SupportRequest["topic"]
) {
  if (
    topic ===
    "service"
  ) {
    return "Service Request";
  }

  if (
    topic ===
    "product"
  ) {
    return "Product Help";
  }

  return "General Support";
}

function requestTitle(
  request:
    SupportRequest
) {
  if (
    request.topic ===
    "service"
  ) {
    return `${request.service_name ?? "Service"}${
      request.package_name
        ? ` · ${request.package_name}`
        : ""
    }`;
  }

  if (
    request.topic ===
    "product"
  ) {
    return (
      request.product_name ??
      "Product Support"
    );
  }

  return (
    request.general_subject ??
    "General Support"
  );
}

/* =========================================================
   PAGE
========================================================= */

export default async function AdminRequestsPage() {
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
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );

  if (
    error
  ) {
    throw new Error(
      `Unable to load legacy support requests: ${error.message}`
    );
  }

  const requests =
    (
      data ??
      []
    ) as unknown as
      SupportRequest[];

  /* =======================================================
     ARCHIVE COUNTS
  ======================================================= */

  const serviceCount =
    requests.filter(
      (
        request
      ) =>
        request.topic ===
        "service"
    ).length;

  const productCount =
    requests.filter(
      (
        request
      ) =>
        request.topic ===
        "product"
    ).length;

  const generalCount =
    requests.filter(
      (
        request
      ) =>
        request.topic ===
        "general"
    ).length;

  /* =======================================================
     UI
  ======================================================= */

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
        {/* =================================================
            HEADER
        ================================================= */}

        <header
          className={
            styles.header
          }
        >
          <div>
            <span>
              BIRDSHOP / LEGACY
            </span>

            <h1>
              Legacy Support
            </h1>

            <p>
              Historical support requests from the previous
              BirdShop request system. New Service, Product,
              and General Support conversations are now
              managed in Admin Chat.
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
              TOTAL
            </span>

            <strong>
              {
                requests.length
              }
            </strong>

            <small>
              LEGACY RECORDS
            </small>
          </article>

          <article>
            <span>
              SERVICE
            </span>

            <strong>
              {
                serviceCount
              }
            </strong>

            <small>
              OLD REQUESTS
            </small>
          </article>

          <article>
            <span>
              PRODUCT
            </span>

            <strong>
              {
                productCount
              }
            </strong>

            <small>
              OLD SUPPORT
            </small>
          </article>

          <article>
            <span>
              GENERAL
            </span>

            <strong>
              {
                generalCount
              }
            </strong>

            <small>
              OLD SUPPORT
            </small>
          </article>
        </section>

        {/* =================================================
            EXPLANATION
        ================================================= */}

        <div
          className={
            styles.sectionHeading
          }
        >
          <div>
            <span>
              READ ONLY ARCHIVE
            </span>

            <h2>
              Previous support records.
            </h2>
          </div>

          <p>
            These records are preserved for history only.
            Do not continue active support work here.
            New conversations belong in Admin Chat.
          </p>
        </div>

        {/* =================================================
            EMPTY
        ================================================= */}

        {requests.length ===
        0 ? (
          <div
            className={
              styles.empty
            }
          >
            No legacy support records.
          </div>
        ) : (
          /* ===============================================
             ARCHIVE LIST
          =============================================== */

          <div
            className={
              styles.list
            }
          >
            {requests.map(
              (
                request
              ) => (
                <article
                  key={
                    request.id
                  }
                  className={
                    styles.card
                  }
                >
                  {/* =====================================
                      TOP
                  ===================================== */}

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
                        {requestTitle(
                          request
                        )}
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

                  {/* =====================================
                      MESSAGE
                  ===================================== */}

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

                    {/* ===================================
                        METADATA
                    =================================== */}

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
                            ORDER /
                            REFERENCE
                          </span>

                          <strong>
                            {
                              request.order_reference
                            }
                          </strong>
                        </div>
                      )}

                      {/* =================================
                          SERVICE
                      ================================= */}

                      {request.topic ===
                        "service" && (
                        <>
                          <div>
                            <span>
                              SERVICE
                            </span>

                            <strong>
                              {request.service_name ??
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              PACKAGE
                            </span>

                            <strong>
                              {request.package_name ??
                                "—"}
                            </strong>
                          </div>

                          {request.package_price !==
                            null && (
                            <div>
                              <span>
                                PACKAGE PRICE
                              </span>

                              <strong>
                                $
                                {Number(
                                  request.package_price
                                ).toFixed(
                                  2
                                )}
                              </strong>
                            </div>
                          )}
                        </>
                      )}

                      {/* =================================
                          PRODUCT
                      ================================= */}

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
                              PLATFORM /
                              REGION
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

                      {/* =================================
                          GENERAL
                      ================================= */}

                      {request.topic ===
                        "general" &&
                        request.general_subject && (
                          <div>
                            <span>
                              SUBJECT
                            </span>

                            <strong>
                              {
                                request.general_subject
                              }
                            </strong>
                          </div>
                        )}

                      {/* =================================
                          HISTORICAL ADMIN
                      ================================= */}

                      <div>
                        <span>
                          ASSIGNED ADMIN
                        </span>

                        <strong>
                          {request.assigned_to ||
                            "Unassigned"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          SOURCE
                        </span>

                        <strong>
                          {
                            request.source
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          RECORD TYPE
                        </span>

                        <strong>
                          Legacy / Read Only
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* =====================================
                      READ ONLY NOTICE
                  ===================================== */}

                  <div
                    className={
                      styles.settledNote
                    }
                  >
                    <span>
                      ARCHIVED SYSTEM
                    </span>

                    <strong>
                      Read Only
                    </strong>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}