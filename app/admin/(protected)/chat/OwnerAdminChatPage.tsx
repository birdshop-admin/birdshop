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

type ConversationType =
  | "service"
  | "product"
  | "general";

type ConversationFilter =
  | "all"
  | ConversationType;

type Conversation = {
  id: string;

  order_id:
    | string
    | null;

  public_token: string;

  reference: string;

  conversation_type:
    ConversationType;

  workflow_status:
    string;

  status: string;

  last_message_at:
    string;

  last_sender_type:
    | string
    | null;

  admin_last_read_at:
    | string
    | null;

  created_at:
    string;

  deleted_at:
    | string
    | null;

  customer_name:
    | string
    | null;

  customer_email:
    | string
    | null;

  customer_contact:
    | string
    | null;

  subject:
    | string
    | null;

  service_name:
    | string
    | null;

  package_name:
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
};

type Order = {
  id:
    string;

  reference:
    string;

  customer_name:
    string;

  customer_contact:
    | string
    | null;

  customer_email:
    string;

  service_name:
    | string
    | null;

  package_name:
    | string
    | null;

  total:
    | number
    | string;

  payment_status:
    string;

  service_status:
    | string
    | null;
};

type PageProps = {
  searchParams:
    Promise<{
      view?:
        string;

      type?:
        string;

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
):
  ChatView {

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

function normalizeType(
  value:
    | string
    | undefined
):
  ConversationFilter {

  if (
    value ===
      "service" ||
    value ===
      "product" ||
    value ===
      "general"
  ) {
    return value;
  }

  return "all";
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
    | undefined
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

function conversationTypeLabel(
  type:
    ConversationType
) {
  if (
    type ===
      "product"
  ) {
    return "PRODUCT SUPPORT";
  }

  if (
    type ===
      "general"
  ) {
    return "GENERAL SUPPORT";
  }

  return "SERVICE";
}

function conversationFilterLabel(
  type:
    ConversationFilter
) {
  if (
    type ===
      "service"
  ) {
    return "SERVICE";
  }

  if (
    type ===
      "product"
  ) {
    return "PRODUCT SUPPORT";
  }

  if (
    type ===
      "general"
  ) {
    return "GENERAL SUPPORT";
  }

  return "ALL";
}

function getOrder(
  conversation:
    Conversation,
  orderMap:
    Map<
      string,
      Order
    >
) {
  if (
    !conversation.order_id
  ) {
    return undefined;
  }

  return orderMap.get(
    conversation.order_id
  );
}

function getReference(
  conversation:
    Conversation,
  order?:
    Order
) {
  return (
    conversation.reference ||
    order?.reference ||
    "BIRDSHOP"
  );
}

function getConversationTitle(
  conversation:
    Conversation,
  order?:
    Order
) {
  if (
    conversation.conversation_type ===
      "product"
  ) {
    return (
      conversation.product_name ||
      conversation.subject ||
      "Product Support"
    );
  }

  if (
    conversation.conversation_type ===
      "general"
  ) {
    return (
      conversation.subject ||
      "General Support"
    );
  }

  return (
    conversation.service_name ||
    order?.service_name ||
    conversation.subject ||
    "Custom Service Request"
  );
}

function getConversationSubtitle(
  conversation:
    Conversation,
  order?:
    Order
) {
  if (
    conversation.conversation_type ===
      "product"
  ) {
    const details =
      [
        conversation.product_platform,
        conversation.product_region,
      ].filter(
        Boolean
      );

    return (
      details.join(
        " · "
      ) ||
      "Product Support"
    );
  }

  if (
    conversation.conversation_type ===
      "general"
  ) {
    return "General Support";
  }

  return (
    conversation.package_name ||
    order?.package_name ||
    "Custom Quote"
  );
}

function getCustomerName(
  conversation:
    Conversation,
  order?:
    Order
) {
  return (
    conversation.customer_name ||
    order?.customer_name ||
    "Customer"
  );
}

function getCustomerContact(
  conversation:
    Conversation,
  order?:
    Order
) {
  return (
    conversation.customer_contact ||
    conversation.customer_email ||
    order?.customer_contact ||
    order?.customer_email ||
    "No contact available"
  );
}

function isUnread(
  conversation:
    Conversation
) {
  if (
    conversation.last_sender_type !==
      "customer"
  ) {
    return false;
  }

  if (
    !conversation.admin_last_read_at
  ) {
    return true;
  }

  return (
    new Date(
      conversation.last_message_at
    ).getTime() >
    new Date(
      conversation.admin_last_read_at
    ).getTime()
  );
}

function filterConversations(
  conversations:
    Conversation[],
  type:
    ConversationFilter
) {
  if (
    type ===
      "all"
  ) {
    return conversations;
  }

  return conversations.filter(
    (
      conversation
    ) =>
      conversation.conversation_type ===
      type
  );
}

function countType(
  conversations:
    Conversation[],
  type:
    ConversationFilter
) {
  return filterConversations(
    conversations,
    type
  ).length;
}

function countUnread(
  conversations:
    Conversation[],
  type:
    ConversationFilter
) {
  return filterConversations(
    conversations,
    type
  ).filter(
    isUnread
  ).length;
}

function buildChatHref({
  view,
  type,
  conversation,
}: {
  view:
    ChatView;

  type:
    ConversationFilter;

  conversation?:
    string;
}) {
  const params =
    new URLSearchParams();

  params.set(
    "view",
    view
  );

  params.set(
    "type",
    type
  );

  if (
    conversation
  ) {
    params.set(
      "conversation",
      conversation
    );
  }

  return `/admin/chat?${params.toString()}`;
}

/* =========================================================
   CLOSED / DELETED CARD
========================================================= */

function CompactConversation({
  conversation,
  order,
  view,
  filter,
}: {
  conversation:
    Conversation;

  order:
    | Order
    | undefined;

  view:
    | "closed"
    | "deleted";

  filter:
    ConversationFilter;
}) {
  const reference =
    getReference(
      conversation,
      order
    );

  const title =
    getConversationTitle(
      conversation,
      order
    );

  const subtitle =
    getConversationSubtitle(
      conversation,
      order
    );

  const customerName =
    getCustomerName(
      conversation,
      order
    );

  const customerContact =
    getCustomerContact(
      conversation,
      order
    );

  return (
    <article
      className={
        styles.compactCard
      }
    >
      <div>
        <span>
          {conversationTypeLabel(
            conversation.conversation_type
          )}{" "}
          ·{" "}
          {reference}{" "}
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
          {
            title
          }
        </strong>

        <p>
          {
            customerName
          }

          {subtitle
            ? ` · ${subtitle}`
            : ""}

          {customerContact
            ? ` · ${customerContact}`
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

              <input
                type="hidden"
                name="type"
                value={
                  filter
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

  const filter =
    normalizeType(
      params.type
    );

  const supabase =
    await createClient();

  /* =======================================================
     ALL CONVERSATIONS
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
        `
        id,
        order_id,
        public_token,
        reference,
        conversation_type,
        workflow_status,
        status,
        last_message_at,
        last_sender_type,
        admin_last_read_at,
        created_at,
        deleted_at,
        customer_name,
        customer_email,
        customer_contact,
        subject,
        service_name,
        package_name,
        product_name,
        product_platform,
        product_region
        `
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

  /* =======================================================
     STATUS GROUPS
  ======================================================= */

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

  const viewConversations =
    view ===
      "active"
      ? activeConversations
      : view ===
          "closed"
        ? closedConversations
        : deletedConversations;

  const filteredConversations =
    filterConversations(
      viewConversations,
      filter
    );

  /* =======================================================
     LINKED ORDERS
  ======================================================= */

  const orderIds =
    Array.from(
      new Set(
        allConversations
          .map(
            (
              conversation
            ) =>
              conversation.order_id
          )
          .filter(
            (
              value
            ):
              value is string =>
              Boolean(
                value
              )
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

    if (
      error
    ) {
      throw new Error(
        `Unable to load linked orders: ${error.message}`
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
    new Map<
      string,
      Order
    >(
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
     SELECTED CONVERSATION

     Selection only comes from the CURRENT FILTER.
  ======================================================= */

  const selected =
    view ===
      "active"
      ? filteredConversations.find(
          (
            conversation
          ) =>
            conversation.id ===
            params.conversation
        ) ??
        filteredConversations[0] ??
        null
      : null;

  /* =======================================================
     MESSAGES / PAYMENT REQUESTS
  ======================================================= */

  let messages:
    AdminLiveMessage[] =
    [];

  let paymentRequests:
    AdminLivePaymentRequest[] =
    [];

  if (
    selected
  ) {
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

    if (
      isUnread(
        selected
      )
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

  /* =======================================================
     SELECTED DATA
  ======================================================= */

  const selectedOrder =
    selected
      ? getOrder(
          selected,
          orderMap
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

  const paidPayment =
    [
      ...paymentRequests,
    ]
      .reverse()
      .find(
        (
          request
        ) =>
          request.status ===
          "paid"
      ) ??
    null;

  const latestPayment =
    paymentRequests.length >
    0
      ? paymentRequests[
          paymentRequests.length -
            1
        ]
      : null;

  const selectedReference =
    selected
      ? getReference(
          selected,
          selectedOrder ??
            undefined
        )
      : "";

  const selectedTitle =
    selected
      ? getConversationTitle(
          selected,
          selectedOrder ??
            undefined
        )
      : "";

  const selectedSubtitle =
    selected
      ? getConversationSubtitle(
          selected,
          selectedOrder ??
            undefined
        )
      : "";

  const selectedCustomer =
    selected
      ? getCustomerName(
          selected,
          selectedOrder ??
            undefined
        )
      : "";

  const selectedContact =
    selected
      ? getCustomerContact(
          selected,
          selectedOrder ??
            undefined
        )
      : "";

  const paymentStatus =
    selectedOrder
      ?.payment_status ??
    (
      paidPayment
        ? "paid"
        : pendingPayment
          ? "pending"
          : "not_requested"
    );

  const workflowStatus =
    selectedOrder
      ?.service_status ??
    selected
      ?.workflow_status ??
    "new";

  const quotedAmount =
    selectedOrder &&
    Number(
      selectedOrder.total
    ) >
      0
      ? Number(
          selectedOrder.total
        )
      : latestPayment
        ? Number(
            latestPayment.amount
          )
        : 0;

  /* =======================================================
     CATEGORY COUNTS FOR CURRENT STATUS TAB
  ======================================================= */

  const allCount =
    countType(
      viewConversations,
      "all"
    );

  const serviceCount =
    countType(
      viewConversations,
      "service"
    );

  const productCount =
    countType(
      viewConversations,
      "product"
    );

  const generalCount =
    countType(
      viewConversations,
      "general"
    );

  const allUnread =
    view ===
      "active"
      ? countUnread(
          activeConversations,
          "all"
        )
      : 0;

  const serviceUnread =
    view ===
      "active"
      ? countUnread(
          activeConversations,
          "service"
        )
      : 0;

  const productUnread =
    view ===
      "active"
      ? countUnread(
          activeConversations,
          "product"
        )
      : 0;

  const generalUnread =
    view ===
      "active"
      ? countUnread(
          activeConversations,
          "general"
        )
      : 0;

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
              Manage service requests, product support, and
              general support from one private BirdShop
              conversation workspace.
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
            STATUS
        ================================================= */}

        <nav
          className={
            styles.tabs
          }
        >
          <Link
            href={
              buildChatHref({
                view:
                  "active",

                type:
                  filter,
              })
            }
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
            href={
              buildChatHref({
                view:
                  "closed",

                type:
                  filter,
              })
            }
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
            href={
              buildChatHref({
                view:
                  "deleted",

                type:
                  filter,
              })
            }
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
            CATEGORY FILTER
        ================================================= */}

        <nav
          className={
            styles.tabs
          }
        >
          <Link
            href={
              buildChatHref({
                view,

                type:
                  "all",
              })
            }
            className={
              filter ===
                "all"
                ? styles.activeTab
                : ""
            }
          >
            All

            <span>
              {
                allCount
              }

              {allUnread >
                0
                ? ` · ${allUnread} new`
                : ""}
            </span>
          </Link>

          <Link
            href={
              buildChatHref({
                view,

                type:
                  "service",
              })
            }
            className={
              filter ===
                "service"
                ? styles.activeTab
                : ""
            }
          >
            Service

            <span>
              {
                serviceCount
              }

              {serviceUnread >
                0
                ? ` · ${serviceUnread} new`
                : ""}
            </span>
          </Link>

          <Link
            href={
              buildChatHref({
                view,

                type:
                  "product",
              })
            }
            className={
              filter ===
                "product"
                ? styles.activeTab
                : ""
            }
          >
            Product Support

            <span>
              {
                productCount
              }

              {productUnread >
                0
                ? ` · ${productUnread} new`
                : ""}
            </span>
          </Link>

          <Link
            href={
              buildChatHref({
                view,

                type:
                  "general",
              })
            }
            className={
              filter ===
                "general"
                ? styles.activeTab
                : ""
            }
          >
            General Support

            <span>
              {
                generalCount
              }

              {generalUnread >
                0
                ? ` · ${generalUnread} new`
                : ""}
            </span>
          </Link>
        </nav>

        {/* =================================================
            ACTIVE WORKSPACE
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
                  {conversationFilterLabel(
                    filter
                  )}{" "}
                  INBOX
                </span>

                <strong>
                  {
                    filteredConversations.length
                  }{" "}
                  {filteredConversations.length ===
                    1
                    ? "conversation"
                    : "conversations"}
                </strong>
              </div>

              {filteredConversations.length ===
              0 ? (
                <div
                  className={
                    styles.emptyInbox
                  }
                >
                  No active{" "}
                  {conversationFilterLabel(
                    filter
                  ).toLowerCase()}{" "}
                  conversations.
                </div>
              ) : (
                <div
                  className={
                    styles.conversationList
                  }
                >
                  {filteredConversations.map(
                    (
                      conversation
                    ) => {
                      const order =
                        getOrder(
                          conversation,
                          orderMap
                        );

                      const unread =
                        isUnread(
                          conversation
                        );

                      return (
                        <Link
                          key={
                            conversation.id
                          }
                          href={
                            buildChatHref({
                              view:
                                "active",

                              type:
                                filter,

                              conversation:
                                conversation.id,
                            })
                          }
                          className={`${styles.conversationItem} ${
                            selected?.id ===
                            conversation.id
                              ? styles.activeConversation
                              : ""
                          }`}
                        >
                          <div>
                            <span>
                              {conversationTypeLabel(
                                conversation.conversation_type
                              )}
                              {" · "}
                              {getReference(
                                conversation,
                                order
                              )}
                            </span>

                            {unread && (
                              <small>
                                NEW
                              </small>
                            )}
                          </div>

                          <strong>
                            {getConversationTitle(
                              conversation,
                              order
                            )}
                          </strong>

                          <p>
                            {getCustomerName(
                              conversation,
                              order
                            )}
                            {" · "}
                            {getConversationSubtitle(
                              conversation,
                              order
                            )}
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
                EMPTY
            ============================================= */}

            {!selected ? (
              <section
                className={
                  styles.emptyChat
                }
              >
                {filteredConversations.length ===
                0
                  ? `No ${conversationFilterLabel(
                      filter
                    ).toLowerCase()} conversations are waiting here.`
                  : "Select a conversation to begin."}
              </section>
            ) : (
              /* ===========================================
                 CHAT
              =========================================== */

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
                      {conversationTypeLabel(
                        selected.conversation_type
                      )}
                      {" · "}
                      {
                        selectedReference
                      }
                    </span>

                    <h2>
                      {
                        selectedTitle
                      }
                    </h2>

                    <p>
                      {
                        selectedSubtitle
                      }
                    </p>
                  </div>

                  <div
                    className={
                      styles.orderFacts
                    }
                  >
                    {selected.conversation_type ===
                    "service" ? (
                      <>
                        <div>
                          <span>
                            PAYMENT
                          </span>

                          <strong>
                            {statusLabel(
                              paymentStatus
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            STATUS
                          </span>

                          <strong>
                            {statusLabel(
                              workflowStatus
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            ORDER
                          </span>

                          <strong>
                            {selectedOrder
                              ? "Linked"
                              : "Not Created"}
                          </strong>
                        </div>
                      </>
                    ) : selected.conversation_type ===
                      "product" ? (
                      <>
                        <div>
                          <span>
                            TYPE
                          </span>

                          <strong>
                            Product Support
                          </strong>
                        </div>

                        <div>
                          <span>
                            PLATFORM
                          </span>

                          <strong>
                            {selected.product_platform ||
                              "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            STATUS
                          </span>

                          <strong>
                            {statusLabel(
                              selected.workflow_status
                            )}
                          </strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span>
                            TYPE
                          </span>

                          <strong>
                            General Support
                          </strong>
                        </div>

                        <div>
                          <span>
                            SUBJECT
                          </span>

                          <strong>
                            {selected.subject ||
                              "General Question"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            STATUS
                          </span>

                          <strong>
                            {statusLabel(
                              selected.workflow_status
                            )}
                          </strong>
                        </div>
                      </>
                    )}
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
                        selectedCustomer
                      }
                    </strong>

                    <small>
                      {
                        selectedContact
                      }
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
                    SERVICE PAYMENT CENTER
                ========================================= */}

                {selected.conversation_type ===
                "service" ? (
                  <section>
                    {paymentStatus ===
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
                                    defaultValue={`${selectedTitle}${
                                      selectedSubtitle
                                        ? ` — ${selectedSubtitle}`
                                        : ""
                                    }`}
                                    maxLength={
                                      180
                                    }
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
                                    max="1000000"
                                    step="0.01"
                                    defaultValue={
                                      quotedAmount >
                                      0
                                        ? quotedAmount.toFixed(
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
                                  rows={
                                    2
                                  }
                                  maxLength={
                                    2000
                                  }
                                  placeholder="Describe exactly what this payment covers..."
                                />
                              </label>

                              <div
                                className={
                                  paymentStyles.actions
                                }
                              >
                                <span>
                                  Sending a request does not create an order. The order is linked after verified payment.
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
                ) : (
                  /* =======================================
                     PRODUCT / GENERAL SUPPORT
                  ======================================= */

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
                        {selected.conversation_type ===
                        "product"
                          ? "PRODUCT SUPPORT"
                          : "GENERAL SUPPORT"}
                      </span>

                      <strong>
                        Private support conversation
                      </strong>
                    </div>

                    <strong>
                      NO PAYMENT
                    </strong>
                  </div>
                )}

                {/* =========================================
                    LIVE THREAD
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

                  {selectedOrder ? (
                    <Link
                      href="/admin/orders?view=services"
                    >
                      Open Linked Order →
                    </Link>
                  ) : selected.conversation_type ===
                    "service" ? (
                    <span>
                      No order created yet
                    </span>
                  ) : (
                    <span>
                      Support conversation
                    </span>
                  )}
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
            {filteredConversations.length ===
            0 ? (
              <div
                className={
                  styles.emptyChat
                }
              >
                No{" "}
                {conversationFilterLabel(
                  filter
                ).toLowerCase()}{" "}
                conversations in this section.
              </div>
            ) : (
              filteredConversations.map(
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
                      getOrder(
                        conversation,
                        orderMap
                      )
                    }
                    view={
                      view
                    }
                    filter={
                      filter
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