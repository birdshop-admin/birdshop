import Link from "next/link";

import AdminSidebar from "@/components/AdminSidebar";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  archiveOrder,
  createTestServiceOrder,
  deleteTestOrder,
  markTestServicePaid,
  permanentlyDeleteOrder,
  restoreDeletedOrder,
  softDeleteOrder,
  unarchiveOrder,
  updateServiceOrder,
} from "./actions";

import styles from "./orders.module.css";

export const dynamic =
  "force-dynamic";

type View =
  | "services"
  | "digital"
  | "completed"
  | "archived"
  | "deleted"
  | "testing";

type Order = {
  id: string;
  reference: string;

  customer_name: string;
  customer_email: string;
  customer_contact:
    | string
    | null;

  order_type:
    | "product"
    | "service";

  order_status: string;
  payment_status: string;
  fulfillment_status:
    string;

  total:
    | number
    | string;

  source: string;

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

  service_status:
    | string
    | null;

  service_request_message:
    | string
    | null;

  assigned_to:
    | string
    | null;

  notes:
    | string
    | null;

  archived_at:
    | string
    | null;

  deleted_at:
    | string
    | null;

  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;

  line_total:
    | number
    | string;
};

type PageProps = {
  searchParams: Promise<{
    view?: string;
    message?: string;
    tone?: string;
  }>;
};

/* =========================================================
   HELPERS
========================================================= */

function money(
  value:
    | number
    | string
) {
  return Number(
    value
  ).toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",
    }
  );
}

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

function labelStatus(
  value:
    | string
    | null
) {
  return (
    value ??
    "new"
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function isCompletedOrder(
  order: Order
) {
  if (
    order.order_type ===
    "service"
  ) {
    return (
      order.service_status ===
      "completed"
    );
  }

  return (
    order.payment_status ===
      "paid" &&
    order.fulfillment_status ===
      "fulfilled"
  );
}

function canHardDelete(
  order: Order
) {
  return (
    order.source ===
      "admin_test" ||
    order.payment_status !==
      "paid"
  );
}

/* =========================================================
   PAGE
========================================================= */

export default async function AdminOrdersPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const requestedView =
    params.view;

  const view: View =
    requestedView ===
      "digital" ||
    requestedView ===
      "completed" ||
    requestedView ===
      "archived" ||
    requestedView ===
      "deleted" ||
    requestedView ===
      "testing"
      ? requestedView
      : "services";

  const supabase =
    await createClient();

  const [
    ordersResult,
    itemsResult,
  ] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(300),

      supabase
        .from("order_items")
        .select(
          "id, order_id, product_name, quantity, line_total"
        ),
    ]);

  if (
    ordersResult.error
  ) {
    throw new Error(
      `Unable to load orders: ${ordersResult.error.message}`
    );
  }

  if (
    itemsResult.error
  ) {
    throw new Error(
      `Unable to load order items: ${itemsResult.error.message}`
    );
  }

  const orders =
    (
      ordersResult.data ??
      []
    ) as unknown as Order[];

  const items =
    (
      itemsResult.data ??
      []
    ) as unknown as OrderItem[];

  /* =======================================================
     ITEM MAP
  ======================================================= */

  const itemsByOrder =
    new Map<
      string,
      OrderItem[]
    >();

  for (
    const item
    of items
  ) {
    const current =
      itemsByOrder.get(
        item.order_id
      ) ?? [];

    current.push(item);

    itemsByOrder.set(
      item.order_id,
      current
    );
  }

  /* =======================================================
     GROUPING

     Priority:
       Deleted
       Archived
       Completed
       Active service/digital
  ======================================================= */

  const deletedOrders =
    orders.filter(
      (order) =>
        Boolean(
          order.deleted_at
        )
    );

  const notDeleted =
    orders.filter(
      (order) =>
        !order.deleted_at
    );

  const archivedOrders =
    notDeleted.filter(
      (order) =>
        Boolean(
          order.archived_at
        )
    );

  const liveOrders =
    notDeleted.filter(
      (order) =>
        !order.archived_at
    );

  const completedOrders =
    liveOrders.filter(
      isCompletedOrder
    );

  const unfinishedOrders =
    liveOrders.filter(
      (order) =>
        !isCompletedOrder(
          order
        )
    );

  const serviceOrders =
    unfinishedOrders.filter(
      (order) =>
        order.order_type ===
        "service"
    );

  const digitalOrders =
    unfinishedOrders.filter(
      (order) =>
        order.order_type ===
        "product"
    );

  /* =======================================================
     STATS
  ======================================================= */

  const activeServices =
    serviceOrders.filter(
      (order) =>
        ![
          "cancelled",
        ].includes(
          order.service_status ??
            "new"
        )
    ).length;

  const awaitingPayment =
    serviceOrders.filter(
      (order) =>
        order.payment_status !==
          "paid" &&
        order.service_status ===
          "awaiting_payment"
    ).length;

  const waitingCustomers =
    serviceOrders.filter(
      (order) =>
        order.service_status ===
        "waiting_customer"
    ).length;

  /*
   * Revenue still uses ALL real completed paid service
   * orders, even if an admin later soft-deletes or archives
   * the record. Soft delete should not rewrite history.
   */
  const completedPaidServices =
    orders.filter(
      (order) =>
        order.order_type ===
          "service" &&
        order.source !==
          "admin_test" &&
        order.payment_status ===
          "paid" &&
        order.service_status ===
          "completed"
    );

  const serviceRevenue =
    completedPaidServices.reduce(
      (
        total,
        order
      ) =>
        total +
        Number(
          order.total
        ),
      0
    );

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
              BIRDSHOP / OPERATIONS
            </span>

            <h1>
              Orders
            </h1>

            <p>
              Active service work, digital purchases, completed sales, archived records, and deleted records are separated so the daily queue stays clean.
            </p>
          </div>

          <div
            className={
              styles.headerBadge
            }
          >
            SERVICE-FIRST
          </div>
        </header>

        {params.message && (
          <div
            className={`${styles.notice} ${
              params.tone ===
              "error"
                ? styles.noticeError
                : styles.noticeSuccess
            }`}
          >
            {
              params.message
            }
          </div>
        )}

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
              ACTIVE SERVICES
            </span>

            <strong>
              {
                activeServices
              }
            </strong>

            <small>
              REQUIRES STAFF WORK
            </small>
          </article>

          <article>
            <span>
              AWAITING PAYMENT
            </span>

            <strong>
              {
                awaitingPayment
              }
            </strong>

            <small>
              PAYMENT REQUESTED
            </small>
          </article>

          <article>
            <span>
              WAITING CUSTOMER
            </span>

            <strong>
              {
                waitingCustomers
              }
            </strong>

            <small>
              CUSTOMER RESPONSE
            </small>
          </article>

          <article>
            <span>
              SERVICE REVENUE
            </span>

            <strong>
              {money(
                serviceRevenue
              )}
            </strong>

            <small>
              REAL PAID COMPLETIONS
            </small>
          </article>
        </section>

        {/* =================================================
            TABS
        ================================================= */}

        <nav
          className={
            styles.tabs
          }
        >
          <Link
            href="/admin/orders?view=services"
            className={
              view ===
              "services"
                ? styles.activeTab
                : ""
            }
          >
            Service Queue

            <span>
              {
                serviceOrders.length
              }
            </span>
          </Link>

          <Link
            href="/admin/orders?view=digital"
            className={
              view ===
              "digital"
                ? styles.activeTab
                : ""
            }
          >
            Digital Orders

            <span>
              {
                digitalOrders.length
              }
            </span>
          </Link>

          <Link
            href="/admin/orders?view=completed"
            className={
              view ===
              "completed"
                ? styles.activeTab
                : ""
            }
          >
            Completed

            <span>
              {
                completedOrders.length
              }
            </span>
          </Link>

          <Link
            href="/admin/orders?view=archived"
            className={
              view ===
              "archived"
                ? styles.activeTab
                : ""
            }
          >
            Archived

            <span>
              {
                archivedOrders.length
              }
            </span>
          </Link>

          <Link
            href="/admin/orders?view=deleted"
            className={
              view ===
              "deleted"
                ? styles.activeTab
                : ""
            }
          >
            Deleted

            <span>
              {
                deletedOrders.length
              }
            </span>
          </Link>

          <Link
            href="/admin/orders?view=testing"
            className={
              view ===
              "testing"
                ? styles.activeTab
                : ""
            }
          >
            Testing
          </Link>
        </nav>

        {/* =================================================
            SERVICE QUEUE
        ================================================= */}

        {view ===
          "services" && (
          <section>
            <div
              className={
                styles.sectionHeading
              }
            >
              <div>
                <span>
                  SERVICE OPERATIONS
                </span>

                <h2>
                  Work queue.
                </h2>
              </div>

              <p>
                Only unfinished service work appears here. Once a service is paid and completed, it automatically moves to Completed.
              </p>
            </div>

            {serviceOrders.length ===
            0 ? (
              <div
                className={
                  styles.empty
                }
              >
                No active service orders.
              </div>
            ) : (
              <div
                className={
                  styles.serviceList
                }
              >
                {serviceOrders.map(
                  (order) => {
                    const status =
                      order.service_status ??
                      "new";

                    const paid =
                      order.payment_status ===
                      "paid";

                    const customerRequest =
                      order.service_request_message ||
                      order.notes;

                    return (
                      <article
                        key={
                          order.id
                        }
                        className={
                          styles.serviceCard
                        }
                      >
                        <div
                          className={
                            styles.serviceTop
                          }
                        >
                          <div>
                            <span>
                              {
                                order.reference
                              }{" "}
                              ·{" "}
                              {formatDate(
                                order.created_at
                              )}
                            </span>

                            <h3>
                              {order.service_name ??
                                "Service Order"}
                            </h3>

                            <p>
                              {order.package_name ??
                                "Custom Service"}
                            </p>
                          </div>

                          <div
                            className={
                              styles.servicePrice
                            }
                          >
                            <span>
                              TOTAL
                            </span>

                            <strong>
                              {money(
                                order.total
                              )}
                            </strong>
                          </div>
                        </div>

                        <div
                          className={
                            styles.serviceMeta
                          }
                        >
                          <div>
                            <span>
                              CUSTOMER
                            </span>

                            <strong>
                              {
                                order.customer_name
                              }
                            </strong>

                            <small>
                              {order.customer_contact ||
                                order.customer_email}
                            </small>
                          </div>

                          <div>
                            <span>
                              PAYMENT
                            </span>

                            <strong
                              className={
                                styles.statePill
                              }
                              data-state={
                                order.payment_status
                              }
                            >
                              {labelStatus(
                                order.payment_status
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              SERVICE STATUS
                            </span>

                            <strong
                              className={
                                styles.statePill
                              }
                              data-state={
                                status
                              }
                            >
                              {labelStatus(
                                status
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              ASSIGNED
                            </span>

                            <strong>
                              {order.assigned_to ||
                                "Unassigned"}
                            </strong>
                          </div>
                        </div>

                        {customerRequest && (
                          <div
                            className={
                              styles.note
                            }
                          >
                            <span>
                              CUSTOMER REQUEST
                            </span>

                            <p>
                              {
                                customerRequest
                              }
                            </p>
                          </div>
                        )}

                        {!paid && (
                          <div
                            className={
                              styles.note
                            }
                          >
                            <span>
                              PAYMENT NOT RECEIVED
                            </span>

                            <p>
                              Real customer payment will later be completed through BirdShop checkout or a payment request inside chat. Stripe will automatically mark this order Paid after verified payment.
                            </p>
                          </div>
                        )}

                        <form
                          action={
                            updateServiceOrder
                          }
                          className={
                            styles.assignment
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              order.id
                            }
                          />

                          <label>
                            <span>
                              WORKING ON THIS
                            </span>

                            <input
                              name="assigned_to"
                              type="text"
                              defaultValue={
                                order.assigned_to ??
                                ""
                              }
                              placeholder="Admin name"
                            />
                          </label>

                          <div
                            className={
                              styles.workflowButtons
                            }
                          >
                            <button
                              name="status"
                              value="discussing"
                            >
                              Discussing
                            </button>

                            <button
                              name="status"
                              value="quote_sent"
                            >
                              Quote Sent
                            </button>

                            {!paid && (
                              <button
                                name="status"
                                value="awaiting_payment"
                                className={
                                  styles.primaryAction
                                }
                              >
                                Request Payment
                              </button>
                            )}

                            <button
                              name="status"
                              value="assigned"
                            >
                              Assign
                            </button>

                            <button
                              name="status"
                              value="in_progress"
                              className={
                                styles.primaryAction
                              }
                            >
                              Start Work
                            </button>

                            <button
                              name="status"
                              value="waiting_customer"
                            >
                              Waiting on Customer
                            </button>

                            <button
                              name="status"
                              value="customer_replied"
                            >
                              Customer Replied
                            </button>

                            {paid && (
                              <button
                                name="status"
                                value="ready_for_delivery"
                              >
                                Ready for Delivery
                              </button>
                            )}

                            {paid && (
                              <button
                                name="status"
                                value="completed"
                                className={
                                  styles.primaryAction
                                }
                              >
                                Complete Service
                              </button>
                            )}

                            <button
                              name="status"
                              value="cancelled"
                              className={
                                styles.dangerAction
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        </form>

                        <div
                          className={
                            styles.cardFooter
                          }
                        >
                          {order.source ===
                            "admin_test" &&
                            !paid && (
                              <form
                                action={
                                  markTestServicePaid
                                }
                              >
                                <input
                                  type="hidden"
                                  name="id"
                                  value={
                                    order.id
                                  }
                                />

                                <button
                                  className={
                                    styles.primaryAction
                                  }
                                >
                                  Mark Test Paid
                                </button>
                              </form>
                            )}

                          <form
                            action={
                              archiveOrder
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                order.id
                              }
                            />

                            <button>
                              Archive
                            </button>
                          </form>

                          <form
                            action={
                              softDeleteOrder
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                order.id
                              }
                            />

                            <button
                              className={
                                styles.deleteButton
                              }
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {/* =================================================
            DIGITAL ORDERS
        ================================================= */}

        {view ===
          "digital" && (
          <section>
            <div
              className={
                styles.sectionHeading
              }
            >
              <div>
                <span>
                  DIGITAL FULFILLMENT
                </span>

                <h2>
                  Digital orders.
                </h2>
              </div>

              <p>
                Unfinished digital purchases stay here. Paid and fulfilled purchases automatically move to Completed.
              </p>
            </div>

            {digitalOrders.length ===
            0 ? (
              <div
                className={
                  styles.empty
                }
              >
                No active digital orders.
              </div>
            ) : (
              <div
                className={
                  styles.salesList
                }
              >
                {digitalOrders.map(
                  (order) => {
                    const orderItems =
                      itemsByOrder.get(
                        order.id
                      ) ?? [];

                    const itemText =
                      orderItems
                        .map(
                          (item) =>
                            `${item.quantity}× ${item.product_name}`
                        )
                        .join(", ");

                    return (
                      <article
                        key={
                          order.id
                        }
                        className={
                          styles.saleRow
                        }
                      >
                        <div>
                          <span>
                            {
                              order.reference
                            }
                          </span>

                          <strong>
                            {itemText ||
                              "Digital Product"}
                          </strong>

                          <small>
                            {
                              order.customer_email
                            }
                          </small>
                        </div>

                        <div>
                          <span>
                            PAYMENT
                          </span>

                          <strong
                            className={
                              styles.statePill
                            }
                            data-state={
                              order.payment_status
                            }
                          >
                            {labelStatus(
                              order.payment_status
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            DELIVERY
                          </span>

                          <strong
                            className={
                              styles.statePill
                            }
                            data-state={
                              order.fulfillment_status
                            }
                          >
                            {labelStatus(
                              order.fulfillment_status
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            TOTAL
                          </span>

                          <strong>
                            {money(
                              order.total
                            )}
                          </strong>
                        </div>

                        <div
                          className={
                            styles.saleActions
                          }
                        >
                          <form
                            action={
                              archiveOrder
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                order.id
                              }
                            />

                            <button>
                              Archive
                            </button>
                          </form>

                          <form
                            action={
                              softDeleteOrder
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                order.id
                              }
                            />

                            <button
                              className={
                                styles.deleteButton
                              }
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {/* =================================================
            COMPLETED
        ================================================= */}

        {view ===
          "completed" && (
          <section>
            <div
              className={
                styles.sectionHeading
              }
            >
              <div>
                <span>
                  FINISHED SALES
                </span>

                <h2>
                  Completed.
                </h2>
              </div>

              <p>
                Finished services and paid/fulfilled digital orders are stored here instead of cluttering the active queues.
              </p>
            </div>

            {completedOrders.length ===
            0 ? (
              <div
                className={
                  styles.empty
                }
              >
                No completed orders yet.
              </div>
            ) : (
              <div
                className={
                  styles.salesList
                }
              >
                {completedOrders.map(
                  (order) => (
                    <article
                      key={
                        order.id
                      }
                      className={
                        styles.saleRow
                      }
                    >
                      <div>
                        <span>
                          {
                            order.reference
                          }
                        </span>

                        <strong>
                          {order.order_type ===
                          "service"
                            ? order.service_name ??
                              "Completed Service"
                            : (
                                itemsByOrder.get(
                                  order.id
                                )?.map(
                                  (item) =>
                                    item.product_name
                                ).join(
                                  ", "
                                ) ||
                                "Digital Purchase"
                              )}
                        </strong>

                        <small>
                          {formatDate(
                            order.created_at
                          )}
                        </small>
                      </div>

                      <div>
                        <span>
                          TYPE
                        </span>

                        <strong>
                          {order.order_type ===
                          "service"
                            ? "Service"
                            : "Digital"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          PAYMENT
                        </span>

                        <strong
                          className={
                            styles.statePill
                          }
                          data-state={
                            order.payment_status
                          }
                        >
                          {labelStatus(
                            order.payment_status
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          TOTAL
                        </span>

                        <strong>
                          {money(
                            order.total
                          )}
                        </strong>
                      </div>

                      <div
                        className={
                          styles.saleActions
                        }
                      >
                        <form
                          action={
                            archiveOrder
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              order.id
                            }
                          />

                          <button>
                            Archive
                          </button>
                        </form>

                        <form
                          action={
                            softDeleteOrder
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              order.id
                            }
                          />

                          <button
                            className={
                              styles.deleteButton
                            }
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {/* =================================================
            ARCHIVED
        ================================================= */}

        {view ===
          "archived" && (
          <section>
            <div
              className={
                styles.sectionHeading
              }
            >
              <div>
                <span>
                  HISTORY
                </span>

                <h2>
                  Archived.
                </h2>
              </div>
            </div>

            {archivedOrders.length ===
            0 ? (
              <div
                className={
                  styles.empty
                }
              >
                No archived orders.
              </div>
            ) : (
              <div
                className={
                  styles.salesList
                }
              >
                {archivedOrders.map(
                  (order) => (
                    <article
                      key={
                        order.id
                      }
                      className={
                        styles.saleRow
                      }
                    >
                      <div>
                        <span>
                          {
                            order.reference
                          }
                        </span>

                        <strong>
                          {order.order_type ===
                          "service"
                            ? order.service_name ??
                              "Service"
                            : "Digital Purchase"}
                        </strong>

                        <small>
                          {
                            order.customer_email
                          }
                        </small>
                      </div>

                      <div>
                        <span>
                          TYPE
                        </span>

                        <strong>
                          {labelStatus(
                            order.order_type
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          TOTAL
                        </span>

                        <strong>
                          {money(
                            order.total
                          )}
                        </strong>
                      </div>

                      <div
                        className={
                          styles.saleActions
                        }
                      >
                        <form
                          action={
                            unarchiveOrder
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              order.id
                            }
                          />

                          <button>
                            Restore
                          </button>
                        </form>

                        <form
                          action={
                            softDeleteOrder
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              order.id
                            }
                          />

                          <button
                            className={
                              styles.deleteButton
                            }
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {/* =================================================
            DELETED
        ================================================= */}

        {view ===
          "deleted" && (
          <section>
            <div
              className={
                styles.sectionHeading
              }
            >
              <div>
                <span>
                  TRASH
                </span>

                <h2>
                  Deleted.
                </h2>
              </div>

              <p>
                Restore records from here or permanently remove eligible test/unpaid orders. Real paid transaction records remain protected.
              </p>
            </div>

            {deletedOrders.length ===
            0 ? (
              <div
                className={
                  styles.empty
                }
              >
                Deleted is empty.
              </div>
            ) : (
              <div
                className={
                  styles.salesList
                }
              >
                {deletedOrders.map(
                  (order) => (
                    <article
                      key={
                        order.id
                      }
                      className={
                        styles.saleRow
                      }
                    >
                      <div>
                        <span>
                          {
                            order.reference
                          }
                        </span>

                        <strong>
                          {order.order_type ===
                          "service"
                            ? order.service_name ??
                              "Service"
                            : "Digital Purchase"}
                        </strong>

                        <small>
                          {order.deleted_at
                            ? `Deleted ${formatDate(
                                order.deleted_at
                              )}`
                            : ""}
                        </small>
                      </div>

                      <div>
                        <span>
                          PAYMENT
                        </span>

                        <strong
                          className={
                            styles.statePill
                          }
                          data-state={
                            order.payment_status
                          }
                        >
                          {labelStatus(
                            order.payment_status
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          TOTAL
                        </span>

                        <strong>
                          {money(
                            order.total
                          )}
                        </strong>
                      </div>

                      <div
                        className={
                          styles.saleActions
                        }
                      >
                        <form
                          action={
                            restoreDeletedOrder
                          }
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              order.id
                            }
                          />

                          <button>
                            Restore
                          </button>
                        </form>

                        {canHardDelete(
                          order
                        ) ? (
                          <form
                            action={
                              permanentlyDeleteOrder
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                order.id
                              }
                            />

                            <button
                              className={
                                styles.deleteButton
                              }
                            >
                              Permanently Delete
                            </button>
                          </form>
                        ) : (
                          <small>
                            Paid record retained
                          </small>
                        )}
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {/* =================================================
            TESTING
        ================================================= */}

        {view ===
          "testing" && (
          <section>
            <div
              className={
                styles.sectionHeading
              }
            >
              <div>
                <span>
                  DEVELOPMENT TOOLS
                </span>

                <h2>
                  Test service flow.
                </h2>
              </div>

              <p>
                Test orders can still be permanently removed because they do not represent real customer transactions.
              </p>
            </div>

            <form
              action={
                createTestServiceOrder
              }
              className={
                styles.testForm
              }
            >
              <div
                className={
                  styles.formGrid
                }
              >
                <label>
                  <span>
                    CUSTOMER NAME
                  </span>

                  <input
                    name="customer_name"
                    placeholder="Test Customer"
                    required
                  />
                </label>

                <label>
                  <span>
                    CUSTOMER EMAIL
                  </span>

                  <input
                    name="customer_email"
                    type="email"
                    placeholder="test@example.com"
                    required
                  />
                </label>

                <label>
                  <span>
                    SERVICE
                  </span>

                  <input
                    name="service_name"
                    placeholder="Deepwoken Progression"
                    required
                  />
                </label>

                <label>
                  <span>
                    PACKAGE
                  </span>

                  <input
                    name="package_name"
                    placeholder="Premium"
                  />
                </label>

                <label>
                  <span>
                    PRICE
                  </span>

                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="24.99"
                    required
                  />
                </label>

                <label>
                  <span>
                    NOTE
                  </span>

                  <input
                    name="note"
                    placeholder="Testing service workflow"
                  />
                </label>
              </div>

              <button
                type="submit"
                className={
                  styles.createButton
                }
              >
                Create Test Service Order
              </button>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}