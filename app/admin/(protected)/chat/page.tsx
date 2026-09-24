import Link from "next/link";

import AdminSidebar from "@/components/AdminSidebar";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  cancelPaymentRequest,
  createPaymentRequest,
  deleteConversation,
  permanentlyDeleteConversation,
  restoreConversation,
  setConversationStatus,
} from "./actions";

import AdminLiveThread, {
  AdminLiveMessage,
  AdminLivePaymentRequest,
} from "./AdminLiveThread";

import paymentStyles from "@/components/ChatPaymentUI.module.css";
import styles from "./chat.module.css";

export const dynamic =
  "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ChatView =
  | "active"
  | "closed"
  | "deleted";

type Conversation = {
  id: string;

  order_id: string;

  public_token: string;

  status: string;

  last_message_at: string;

  last_sender_type:
    | string
    | null;

  admin_last_read_at:
    | string
    | null;

  created_at: string;

  deleted_at:
    | string
    | null;
};

type Order = {
  id: string;

  reference: string;

  customer_name: string;

  customer_contact:
    | string
    | null;

  customer_email: string;

  service_name:
    | string
    | null;

  package_name:
    | string
    | null;

  total:
    | number
    | string;

  payment_status: string;

  service_status:
    | string
    | null;
};

type PageProps = {
  searchParams: Promise<{
    view?: string;

    conversation?:
      string;

    message?:
      string;

    tone?:
      string;
  }>;
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeView(
  value:
    | string
    | undefined
): ChatView {
  if (
    value ===
      "closed" ||
    value ===
      "deleted"
  ) {
    return value;
  }

  return "active";
}

function money(
  value:
    | number
    | string,
  currency =
    "USD"
) {
  return Number(
    value
  ).toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        currency.toUpperCase(),
    }
  );
}

function formatDate(
  value:
    string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  ).format(
    new Date(
      value
    )
  );
}

function statusLabel(
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
      (
        character
      ) =>
        character.toUpperCase()
    );
}

/* =========================================================
   COMPACT CLOSED / DELETED CARD
========================================================= */

function CompactConversation({
  conversation,
  order,
  view,
}: {
  conversation:
    Conversation;

  order:
    | Order
    | undefined;

  view:
    | "closed"
    | "deleted";
}) {
  return (
    <article
      className={
        styles.compactCard
      }
    >
      <div>
        <span>
          {order?.reference ??
            "SERVICE"}{" "}
          ·{" "}
          {view ===
            "deleted" &&
          conversation.deleted_at
            ? `DELETED ${formatDate(
                conversation.deleted_at
              )}`
            : `CLOSED · LAST ACTIVITY ${formatDate(
                conversation.last_message_at
              )}`}
        </span>

        <strong>
          {order?.service_name ??
            "Service Conversation"}
        </strong>

        <p>
          {order?.customer_name ??
            "Customer"}

          {order?.package_name
            ? ` · ${order.package_name}`
            : ""}

          {order?.customer_contact ||
          order?.customer_email
            ? ` · ${
                order.customer_contact ||
                order.customer_email
              }`
            : ""}
        </p>
      </div>

      <div
        className={
          styles.compactActions
        }
      >
        {view ===
        "closed" ? (
          <>
            <Link
              href={`/service-chat?token=${encodeURIComponent(
                conversation.public_token
              )}`}
              target="_blank"
            >
              Customer View ↗
            </Link>

            <form
              action={
                setConversationStatus
              }
            >
              <input
                type="hidden"
                name="conversation_id"
                value={
                  conversation.id
                }
              />

              <button
                type="submit"
                name="status"
                value="open"
                className={
                  styles.restoreButton
                }
              >
                Reopen
              </button>
            </form>

            <form
              action={
                deleteConversation
              }
            >
              <input
                type="hidden"
                name="conversation_id"
                value={
                  conversation.id
                }
              />

              <button
                type="submit"
                className={
                  styles.dangerButton
                }
              >
                Delete
              </button>
            </form>
          </>
        ) : (
          <>
            <form
              action={
                restoreConversation
              }
            >
              <input
                type="hidden"
                name="conversation_id"
                value={
                  conversation.id
                }
              />

              <button
                type="submit"
                className={
                  styles.restoreButton
                }
              >
                Restore
              </button>
            </form>

            <form
              action={
                permanentlyDeleteConversation
              }
            >
              <input
                type="hidden"
                name="conversation_id"
                value={
                  conversation.id
                }
              />

              <button
                type="submit"
                className={
                  styles.dangerButton
                }
              >
                Delete Permanently
              </button>
            </form>
          </>
        )}
      </div>
    </article>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default async function AdminChatPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const view =
    normalizeView(
      params.view
    );

  const supabase =
    await createClient();

  /* =======================================================
     CONVERSATIONS
  ======================================================= */

  const {
    data:
      conversationData,

    error:
      conversationError,
  } =
    await supabase
      .from(
        "service_conversations"
      )
      .select(
        "id, order_id, public_token, status, last_message_at, last_sender_type, admin_last_read_at, created_at, deleted_at"
      )
      .order(
        "last_message_at",
        {
          ascending:
            false,
        }
      );

  if (
    conversationError
  ) {
    throw new Error(
      `Unable to load chat conversations: ${conversationError.message}`
    );
  }

  const allConversations =
    (
      conversationData ??
      []
    ) as unknown as
      Conversation[];

  const activeConversations =
    allConversations.filter(
      (
        conversation
      ) =>
        !conversation.deleted_at &&
        conversation.status ===
          "open"
    );

  const closedConversations =
    allConversations.filter(
      (
        conversation
      ) =>
        !conversation.deleted_at &&
        conversation.status !==
          "open"
    );

  const deletedConversations =
    allConversations.filter(
      (
        conversation
      ) =>
        Boolean(
          conversation.deleted_at
        )
    );

  const currentConversations =
    view ===
      "active"
      ? activeConversations
      : view ===
          "closed"
        ? closedConversations
        : deletedConversations;

  /* =======================================================
     ORDERS
  ======================================================= */

  const orderIds =
    Array.from(
      new Set(
        allConversations.map(
          (
            conversation
          ) =>
            conversation.order_id
        )
      )
    );

  let orders:
    Order[] = [];

  if (
    orderIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "orders"
        )
        .select(
          "id, reference, customer_name, customer_contact, customer_email, service_name, package_name, total, payment_status, service_status"
        )
        .in(
          "id",
          orderIds
        );

    if (error) {
      throw new Error(
        `Unable to load service orders: ${error.message}`
      );
    }

    orders =
      (
        data ??
        []
      ) as unknown as
        Order[];
  }

  const orderMap =
    new Map(
      orders.map(
        (
          order
        ) => [
          order.id,
          order,
        ]
      )
    );

  /* =======================================================
     SELECT ACTIVE CHAT
  ======================================================= */

  const selected =
    view ===
      "active"
      ? activeConversations.find(
          (
            conversation
          ) =>
            conversation.id ===
            params.conversation
        ) ??
        activeConversations[0] ??
        null
      : null;

  let messages:
    AdminLiveMessage[] =
    [];

  let paymentRequests:
    AdminLivePaymentRequest[] =
    [];

  if (selected) {
    const [
      messageResult,
      paymentResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "service_messages"
          )
          .select(
            "id, conversation_id, sender_type, sender_label, body, message_type, metadata, created_at"
          )
          .eq(
            "conversation_id",
            selected.id
          )
          .order(
            "created_at",
            {
              ascending:
                true,
            }
          ),

        supabase
          .from(
            "service_payment_requests"
          )
          .select(
            "id, conversation_id, order_id, amount, currency, title, description, status, stripe_checkout_session_id, paid_at, cancelled_at, created_at"
          )
          .eq(
            "conversation_id",
            selected.id
          )
          .order(
            "created_at",
            {
              ascending:
                true,
            }
          ),
      ]);

    if (
      messageResult.error
    ) {
      throw new Error(
        `Unable to load messages: ${messageResult.error.message}`
      );
    }

    if (
      paymentResult.error
    ) {
      throw new Error(
        `Unable to load payment requests: ${paymentResult.error.message}`
      );
    }

    messages =
      (
        messageResult.data ??
        []
      ) as unknown as
        AdminLiveMessage[];

    paymentRequests =
      (
        paymentResult.data ??
        []
      ) as unknown as
        AdminLivePaymentRequest[];

    const shouldMarkRead =
      selected.last_sender_type ===
        "customer" &&
      (
        !selected.admin_last_read_at ||
        new Date(
          selected.last_message_at
        ).getTime() >
          new Date(
            selected.admin_last_read_at
          ).getTime()
      );

    if (
      shouldMarkRead
    ) {
      await supabase
        .from(
          "service_conversations"
        )
        .update({
          admin_last_read_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          selected.id
        );
    }
  }

  const selectedOrder =
    selected
      ? orderMap.get(
          selected.order_id
        ) ??
        null
      : null;

  const pendingPayment =
    paymentRequests.find(
      (
        request
      ) =>
        request.status ===
        "pending"
    ) ??
    null;

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
              BIRDSHOP / COMMUNICATION
            </span>

            <h1>
              Chat
            </h1>

            <p>
              Manage active service conversations, payment requests, completed chats, and archived customer communication.
            </p>
          </div>
        </header>

        {params.message && (
          <div
            className={
              params.tone ===
                "error"
                ? styles.error
                : styles.notice
            }
          >
            {
              params.message
            }
          </div>
        )}

        {/* =================================================
            TABS
        ================================================= */}

        <nav
          className={
            styles.tabs
          }
        >
          <Link
            href="/admin/chat?view=active"
            className={
              view ===
                "active"
                ? styles.activeTab
                : ""
            }
          >
            Active

            <span>
              {
                activeConversations.length
              }
            </span>
          </Link>

          <Link
            href="/admin/chat?view=closed"
            className={
              view ===
                "closed"
                ? styles.activeTab
                : ""
            }
          >
            Closed

            <span>
              {
                closedConversations.length
              }
            </span>
          </Link>

          <Link
            href="/admin/chat?view=deleted"
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
                deletedConversations.length
              }
            </span>
          </Link>
        </nav>

        {/* =================================================
            ACTIVE
        ================================================= */}

        {view ===
        "active" ? (
          <div
            className={
              styles.workspace
            }
          >
            {/* =============================================
                INBOX
            ============================================= */}

            <aside
              className={
                styles.inbox
              }
            >
              <div
                className={
                  styles.inboxHeading
                }
              >
                <span>
                  ACTIVE SERVICE INBOX
                </span>

                <strong>
                  {
                    activeConversations.length
                  }{" "}
                  {activeConversations.length ===
                    1
                    ? "conversation"
                    : "conversations"}
                </strong>
              </div>

              {activeConversations.length ===
              0 ? (
                <div
                  className={
                    styles.emptyInbox
                  }
                >
                  No active service conversations.
                </div>
              ) : (
                <div
                  className={
                    styles.conversationList
                  }
                >
                  {activeConversations.map(
                    (
                      conversation
                    ) => {
                      const order =
                        orderMap.get(
                          conversation.order_id
                        );

                      const unread =
                        conversation.last_sender_type ===
                          "customer" &&
                        (
                          !conversation.admin_last_read_at ||
                          new Date(
                            conversation.last_message_at
                          ).getTime() >
                            new Date(
                              conversation.admin_last_read_at
                            ).getTime()
                        );

                      return (
                        <Link
                          key={
                            conversation.id
                          }
                          href={`/admin/chat?view=active&conversation=${conversation.id}`}
                          className={`${styles.conversationItem} ${
                            selected?.id ===
                            conversation.id
                              ? styles.activeConversation
                              : ""
                          }`}
                        >
                          <div>
                            <span>
                              {order?.reference ??
                                "SERVICE"}
                            </span>

                            {unread && (
                              <small>
                                NEW
                              </small>
                            )}
                          </div>

                          <strong>
                            {order?.service_name ??
                              "Service Order"}
                          </strong>

                          <p>
                            {order?.customer_name ??
                              "Customer"}
                          </p>

                          <time>
                            {formatDate(
                              conversation.last_message_at
                            )}
                          </time>
                        </Link>
                      );
                    }
                  )}
                </div>
              )}
            </aside>

            {/* =============================================
                CHAT
            ============================================= */}

            {!selected ||
            !selectedOrder ? (
              <section
                className={
                  styles.emptyChat
                }
              >
                {activeConversations.length ===
                0
                  ? "Your active service inbox is clear."
                  : "Select a conversation to begin."}
              </section>
            ) : (
              <section
                className={
                  styles.chat
                }
              >
                {/* =========================================
                    HEADER
                ========================================= */}

                <header
                  className={
                    styles.chatHeader
                  }
                >
                  <div>
                    <span>
                      {
                        selectedOrder.reference
                      }
                    </span>

                    <h2>
                      {selectedOrder.service_name ??
                        "Service Order"}
                    </h2>

                    <p>
                      {selectedOrder.package_name ??
                        "Custom Service"}
                    </p>
                  </div>

                  <div
                    className={
                      styles.orderFacts
                    }
                  >
                    <div>
                      <span>
                        PAYMENT
                      </span>

                      <strong>
                        {statusLabel(
                          selectedOrder.payment_status
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        STATUS
                      </span>

                      <strong>
                        {statusLabel(
                          selectedOrder.service_status
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        TOTAL
                      </span>

                      <strong>
                        {money(
                          selectedOrder.total
                        )}
                      </strong>
                    </div>
                  </div>
                </header>

                {/* =========================================
                    CUSTOMER
                ========================================= */}

                <div
                  className={
                    styles.customerBar
                  }
                >
                  <div>
                    <span>
                      CUSTOMER
                    </span>

                    <strong>
                      {
                        selectedOrder.customer_name
                      }
                    </strong>

                    <small>
                      {selectedOrder.customer_contact ||
                        selectedOrder.customer_email}
                    </small>
                  </div>

                  <Link
                    href={`/service-chat?token=${encodeURIComponent(
                      selected.public_token
                    )}`}
                    target="_blank"
                  >
                    Open Customer View ↗
                  </Link>
                </div>

                {/* =========================================
                    PAYMENT CENTER
                ========================================= */}

                <section>
                  {selectedOrder.payment_status ===
                  "paid" ? (
                    <div
                      className={
                        styles.paymentBar
                      }
                    >
                      <div
                        className={
                          styles.paymentBarInfo
                        }
                      >
                        <span>
                          PAYMENT CENTER
                        </span>

                        <strong>
                          Payment received
                        </strong>
                      </div>

                      <strong>
                        ✓ PAID
                      </strong>
                    </div>
                  ) : (
                    <details>
                      <summary
                        className={
                          styles.paymentBar
                        }
                        style={{
                          listStyle:
                            "none",

                          cursor:
                            "pointer",
                        }}
                      >
                        <div
                          className={
                            styles.paymentBarInfo
                          }
                        >
                          <span>
                            PAYMENT CENTER
                          </span>

                          <strong>
                            {pendingPayment
                              ? `${money(
                                  pendingPayment.amount,
                                  pendingPayment.currency
                                )} request pending`
                              : "No payment request sent"}
                          </strong>
                        </div>

                        <span>
                          {pendingPayment
                            ? "Manage Request ↓"
                            : "Create Request ↓"}
                        </span>
                      </summary>

                      <div
                        className={
                          styles.paymentDrawer
                        }
                      >
                        {pendingPayment ? (
                          <article
                            className={
                              paymentStyles.request
                            }
                            data-status={
                              pendingPayment.status
                            }
                          >
                            <div
                              className={
                                paymentStyles.requestTop
                              }
                            >
                              <div>
                                <span
                                  className={
                                    paymentStyles.requestEyebrow
                                  }
                                >
                                  CURRENT PAYMENT REQUEST
                                </span>

                                <strong
                                  className={
                                    paymentStyles.requestTitle
                                  }
                                >
                                  {
                                    pendingPayment.title
                                  }
                                </strong>
                              </div>

                              <span
                                className={
                                  paymentStyles.requestStatus
                                }
                              >
                                {statusLabel(
                                  pendingPayment.status
                                )}
                              </span>
                            </div>

                            {pendingPayment.description && (
                              <p
                                className={
                                  paymentStyles.requestDescription
                                }
                              >
                                {
                                  pendingPayment.description
                                }
                              </p>
                            )}

                            <strong
                              className={
                                paymentStyles.requestAmount
                              }
                            >
                              {money(
                                pendingPayment.amount,
                                pendingPayment.currency
                              )}
                            </strong>

                            <div
                              className={
                                paymentStyles.requestFooter
                              }
                            >
                              <span>
                                Waiting for customer payment.
                              </span>

                              <form
                                action={
                                  cancelPaymentRequest
                                }
                              >
                                <input
                                  type="hidden"
                                  name="conversation_id"
                                  value={
                                    selected.id
                                  }
                                />

                                <input
                                  type="hidden"
                                  name="payment_request_id"
                                  value={
                                    pendingPayment.id
                                  }
                                />

                                <button
                                  type="submit"
                                  className={
                                    paymentStyles.secondaryButton
                                  }
                                >
                                  Cancel Request
                                </button>
                              </form>
                            </div>
                          </article>
                        ) : (
                          <form
                            action={
                              createPaymentRequest
                            }
                            className={
                              paymentStyles.form
                            }
                          >
                            <input
                              type="hidden"
                              name="conversation_id"
                              value={
                                selected.id
                              }
                            />

                            <div
                              className={
                                paymentStyles.fields
                              }
                            >
                              <label
                                className={
                                  paymentStyles.field
                                }
                              >
                                <span
                                  className={
                                    paymentStyles.fieldLabel
                                  }
                                >
                                  TITLE
                                </span>

                                <input
                                  className={
                                    paymentStyles.input
                                  }
                                  name="title"
                                  defaultValue={`${selectedOrder.service_name ?? "BirdShop Service"}${
                                    selectedOrder.package_name
                                      ? ` — ${selectedOrder.package_name}`
                                      : ""
                                  }`}
                                  required
                                />
                              </label>

                              <label
                                className={
                                  paymentStyles.field
                                }
                              >
                                <span
                                  className={
                                    paymentStyles.fieldLabel
                                  }
                                >
                                  AMOUNT
                                </span>

                                <input
                                  className={
                                    paymentStyles.input
                                  }
                                  name="amount"
                                  type="number"
                                  min="0.50"
                                  step="0.01"
                                  defaultValue={
                                    Number(
                                      selectedOrder.total
                                    ) >
                                    0
                                      ? Number(
                                          selectedOrder.total
                                        ).toFixed(
                                          2
                                        )
                                      : ""
                                  }
                                  placeholder="24.99"
                                  required
                                />
                              </label>
                            </div>

                            <label
                              className={
                                paymentStyles.field
                              }
                            >
                              <span
                                className={
                                  paymentStyles.fieldLabel
                                }
                              >
                                DESCRIPTION · OPTIONAL
                              </span>

                              <textarea
                                className={
                                  paymentStyles.textarea
                                }
                                name="description"
                                rows={2}
                                placeholder="Describe exactly what this payment covers..."
                              />
                            </label>

                            <div
                              className={
                                paymentStyles.actions
                              }
                            >
                              <span>
                                The customer cannot change this amount.
                              </span>

                              <button
                                type="submit"
                                className={
                                  paymentStyles.button
                                }
                              >
                                Send Payment Request
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </details>
                  )}
                </section>

                {/* =========================================
                    TRUE LIVE THREAD

                    This owns BOTH:
                    messages
                    composer

                    Nothing here uses router.refresh().
                ========================================= */}

                <AdminLiveThread
                  key={
                    selected.id
                  }
                  conversationId={
                    selected.id
                  }
                  initialMessages={
                    messages
                  }
                  initialPaymentRequests={
                    paymentRequests
                  }
                />

                {/* =========================================
                    FOOTER
                ========================================= */}

                <footer
                  className={
                    styles.chatFooter
                  }
                >
                  <div
                    className={
                      styles.footerActions
                    }
                  >
                    <form
                      action={
                        setConversationStatus
                      }
                    >
                      <input
                        type="hidden"
                        name="conversation_id"
                        value={
                          selected.id
                        }
                      />

                      <button
                        type="submit"
                        name="status"
                        value="closed"
                      >
                        Close Conversation
                      </button>
                    </form>
                  </div>

                  <Link
                    href="/admin/orders?view=services"
                  >
                    Open Service Queue →
                  </Link>
                </footer>
              </section>
            )}
          </div>
        ) : (
          /* =================================================
             CLOSED / DELETED
          ================================================= */

          <section
            className={
              styles.compactArea
            }
          >
            {currentConversations.length ===
            0 ? (
              <div
                className={
                  styles.emptyChat
                }
              >
                {view ===
                "closed"
                  ? "No closed conversations."
                  : "No deleted conversations."}
              </div>
            ) : (
              currentConversations.map(
                (
                  conversation
                ) => (
                  <CompactConversation
                    key={
                      conversation.id
                    }
                    conversation={
                      conversation
                    }
                    order={
                      orderMap.get(
                        conversation.order_id
                      )
                    }
                    view={
                      view
                    }
                  />
                )
              )
            )}
          </section>
        )}
      </section>
    </main>
  );
}