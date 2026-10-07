import PermanentChatDelete from "./PermanentChatDelete";
import { paymentLabel } from "@/lib/payment-display";
import PaymentActionForm, { PaymentFeedback } from "./PaymentActionForm";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";

import { redirect } from "next/navigation";

import AdminSidebar from "@/components/AdminSidebar";
import AdminRefreshButton from "@/components/AdminRefreshButton";

import { createClient } from "@/lib/supabase/server";

import {
  cancelPaymentRequest,
  createPaymentRequest,
  deleteConversation,
  restoreConversation,
  setConversationStatus,
} from "./actions";

import { acceptServiceConversation } from "./agent-actions";

import AdminChatQueueSync from "./AdminChatQueueSync";

import AdminLiveThread, {
  type AdminLiveMessage,
  type AdminLivePaymentRequest,
} from "./AdminLiveThread";

import paymentStyles from "./AdminPaymentCenter.module.css";
import styles from "./OwnerAdminChatPage.module.css";

export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ChatView = "new" | "progress" | "completed" | "closed" | "deleted";

type ConversationType = "service" | "product" | "general";

type ConversationFilter = "all" | ConversationType;

type Conversation = {
  id: string;

  order_id: string | null;

  public_token: string;

  reference: string;

  conversation_type: ConversationType;

  workflow_status: string;

  status: string;

  last_message_at: string;

  last_sender_type: string | null;

  admin_last_read_at: string | null;

  created_at: string;

  deleted_at: string | null;

  customer_name: string | null;

  customer_email: string | null;

  customer_contact: string | null;

  subject: string | null;

  service_name: string | null;

  package_name: string | null;

  product_name: string | null;

  product_platform: string | null;

  product_region: string | null;

  assigned_staff_user_id: string | null;

  assigned_to: string | null;

  assigned_at: string | null;
};

type Order = {
  id: string;

  reference: string;

  customer_name: string;

  customer_contact: string | null;

  customer_email: string;

  service_name: string | null;

  package_name: string | null;

  total: number | string;

  payment_status: string;

  service_status: string | null;
};

type PageProps = {
  searchParams: Promise<{
    view?: string;
    page?: string;

    type?: string;

    conversation?: string;

    message?: string;

    tone?: string;
  }>;
};

/* =========================================================
   NORMALIZE
========================================================= */

function normalizeView(value: string | undefined): ChatView {
  if (
    value === "progress" ||
    value === "completed" ||
    value === "closed" ||
    value === "deleted"
  ) {
    return value;
  }

  /*
   * Old BirdShop links used ?view=active.
   *
   * Treat them as New so old URLs still work.
   */

  return "new";
}

function normalizeType(value: string | undefined): ConversationFilter {
  if (value === "service" || value === "product" || value === "general") {
    return value;
  }

  return "all";
}

/* =========================================================
   URL
========================================================= */

function buildChatHref({
  view,
  type,
  conversation,
}: {
  view: ChatView;

  type: ConversationFilter;

  conversation?: string;
}) {
  const params = new URLSearchParams();

  params.set("view", view);

  params.set("type", type);

  if (conversation) {
    params.set("conversation", conversation);
  }

  return `/admin/chat?${params.toString()}`;
}

/* =========================================================
   LABELS
========================================================= */

function statusLabel(value: string | null | undefined) {
  return (value ?? "new")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function conversationTypeLabel(type: ConversationType) {
  if (type === "product") {
    return "PRODUCT SUPPORT";
  }

  if (type === "general") {
    return "GENERAL SUPPORT";
  }

  return "SERVICE";
}

function filterLabel(type: ConversationFilter) {
  if (type === "service") {
    return "Service";
  }

  if (type === "product") {
    return "Product Support";
  }

  if (type === "general") {
    return "General Support";
  }

  return "All";
}

function viewLabel(view: ChatView) {
  if (view === "progress") {
    return "In Progress";
  }

  if (view === "completed") {
    return "Completed";
  }

  if (view === "closed") {
    return "Closed";
  }

  if (view === "deleted") {
    return "Deleted";
  }

  return "New";
}

/* =========================================================
   FORMAT
========================================================= */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",

    day: "numeric",

    hour: "numeric",

    minute: "2-digit",
  }).format(new Date(value));
}

function money(value: number | string, currency = "USD") {
  return Number(value).toLocaleString("en-US", {
    style: "currency",

    currency: currency.toUpperCase(),
  });
}

/* =========================================================
   CONVERSATION DATA
========================================================= */

function getOrder(
  conversation: Conversation,

  orderMap: Map<string, Order>,
) {
  if (!conversation.order_id) {
    return undefined;
  }

  return orderMap.get(conversation.order_id);
}

function getReference(
  conversation: Conversation,

  order?: Order,
) {
  return conversation.reference || order?.reference || "BIRDSHOP";
}

function getTitle(
  conversation: Conversation,

  order?: Order,
) {
  if (conversation.conversation_type === "product") {
    return (
      conversation.product_name || conversation.subject || "Product Support"
    );
  }

  if (conversation.conversation_type === "general") {
    return conversation.subject || "General Support";
  }

  return (
    conversation.service_name ||
    order?.service_name ||
    conversation.subject ||
    "Custom Service Request"
  );
}

function getSubtitle(
  conversation: Conversation,

  order?: Order,
) {
  if (conversation.conversation_type === "product") {
    const pieces = [
      conversation.product_platform,
      conversation.product_region,
    ].filter(Boolean);

    return pieces.join(" · ") || "Product Support";
  }

  if (conversation.conversation_type === "general") {
    return "General Support";
  }

  return conversation.package_name || order?.package_name || "Custom Quote";
}

function getCustomerName(
  conversation: Conversation,

  order?: Order,
) {
  return conversation.customer_name || order?.customer_name || "Customer";
}

function getCustomerContact(
  conversation: Conversation,

  order?: Order,
) {
  return (
    conversation.customer_contact ||
    conversation.customer_email ||
    order?.customer_contact ||
    order?.customer_email ||
    "No contact available"
  );
}

/* =========================================================
   UNREAD
========================================================= */

function isUnread(conversation: Conversation) {
  if (conversation.last_sender_type !== "customer") {
    return false;
  }

  if (!conversation.admin_last_read_at) {
    return true;
  }

  return (
    new Date(conversation.last_message_at).getTime() >
    new Date(conversation.admin_last_read_at).getTime()
  );
}

/* =========================================================
   STATUS LOGIC
========================================================= */

function getConversationView(
  conversation: Conversation,

  order: Order | undefined,
): ChatView {
  if (conversation.deleted_at) {
    return "deleted";
  }

  if (conversation.status !== "open") {
    return "closed";
  }

  // Payment and completion of service work are separate states.
  if (
    conversation.conversation_type === "service" &&
    order?.service_status === "completed"
  )
    return "completed";

  if (conversation.workflow_status === "completed") {
    return "completed";
  }

  /*
   * Truly untouched/unclaimed requests remain New.
   */

  if (
    (!conversation.workflow_status || conversation.workflow_status === "new") &&
    true
  ) {
    return "new";
  }

  return "progress";
}

/* =========================================================
   FILTER
========================================================= */

function matchesType(
  conversation: Conversation,

  filter: ConversationFilter,
) {
  return filter === "all" || conversation.conversation_type === filter;
}

function sortQueue(conversations: Conversation[]) {
  return [...conversations].sort((a, b) => {
    const unreadA = isUnread(a) ? 1 : 0;

    const unreadB = isUnread(b) ? 1 : 0;

    if (unreadA !== unreadB) {
      return unreadB - unreadA;
    }

    return (
      new Date(b.last_message_at).getTime() -
      new Date(a.last_message_at).getTime()
    );
  });
}

/* =========================================================
   STAFF COLOR

   Deterministic:
   same account = same palette every time.
========================================================= */

function staffPalette(conversation: Conversation) {
  const key =
    conversation.assigned_staff_user_id ||
    conversation.assigned_to ||
    (conversation.workflow_status !== "new" ? "birdshop-owner" : "");

  if (!key) {
    return 0;
  }

  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(index);

    hash |= 0;
  }

  return (Math.abs(hash) % 6) + 1;
}

function staffLabel(conversation: Conversation) {
  if (conversation.assigned_to) {
    return conversation.assigned_to;
  }

  if (conversation.workflow_status !== "new") {
    return "BirdShop";
  }

  return null;
}

/* =========================================================
   PAGE
========================================================= */

export default async function OwnerAdminChatPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(100000, Number(params.page) || 1));
  const pageHref = (next: number) =>
    `/admin/chat?${new URLSearchParams({ page: String(next), view: params.view ?? "new", type: params.type ?? "all" })}`;

  const view = normalizeView(params.view);

  const filter = normalizeType(params.type);

  const supabase = await createClient();

  /* =======================================================
     CONVERSATIONS
  ======================================================= */

  const {
    data: conversationData,

    error: conversationError,
  } = await supabase
    .from("service_conversations")
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
          product_region,
          assigned_staff_user_id,
          assigned_to,
          assigned_at
        `,
    )
    .is("purged_at", null)
    .order("last_message_at", {
      ascending: false,
    })
    .order("id")
    .range((page - 1) * 100, page * 100 - 1);

  if (conversationError) {
    throw new Error(
      `Unable to load chat conversations: Please refresh and retry.`,
    );
  }

  const allConversations = (conversationData ??
    []) as unknown as Conversation[];
  if (
    params.conversation &&
    !allConversations.some((item) => item.id === params.conversation)
  ) {
    const detailResult = await supabase
      .from("service_conversations")
      .select("*")
      .eq("id", params.conversation)
      .is("purged_at", null)
      .maybeSingle();
    if (detailResult.error) throw new Error("Conversation could not load.");
    if (detailResult.data)
      allConversations.push(detailResult.data as Conversation);
  }

  /* =======================================================
     ORDERS
  ======================================================= */

  const orderIds = Array.from(
    new Set(
      allConversations
        .map((conversation) => conversation.order_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let orders: Order[] = [];

  if (orderIds.length > 0) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
            id,
            reference,
            customer_name,
            customer_contact,
            customer_email,
            service_name,
            package_name,
            total,
            payment_status,
            service_status
          `,
      )
      .in("id", orderIds);

    if (error) {
      throw new Error(
        `Unable to load service orders: Please retry or contact the owner.`,
      );
    }

    orders = (data ?? []) as unknown as Order[];
  }

  const orderMap = new Map(orders.map((order) => [order.id, order]));

  /* =======================================================
     STATUS GROUPS
  ======================================================= */

  const groups: Record<ChatView, Conversation[]> = {
    new: [],

    progress: [],

    completed: [],

    closed: [],

    deleted: [],
  };

  for (const conversation of allConversations) {
    const order = getOrder(conversation, orderMap);

    const destination = getConversationView(conversation, order);

    groups[destination].push(conversation);
  }

  groups.new = sortQueue(groups.new);

  groups.progress = sortQueue(groups.progress);

  groups.completed = sortQueue(groups.completed);

  groups.closed = sortQueue(groups.closed);

  groups.deleted = sortQueue(groups.deleted);

  /* =======================================================
     KEEP SELECTED CHAT WITH USER WHEN ITS STATUS CHANGES

     Example:

       In Progress
       ↓ customer pays
       realtime refresh
       ↓
       Completed

     The browser follows the conversation instead of
     suddenly showing an unrelated customer.
  ======================================================= */

  if (params.conversation) {
    const requested = allConversations.find(
      (conversation) => conversation.id === params.conversation,
    );

    if (requested) {
      const requestedOrder = getOrder(requested, orderMap);

      const actualView = getConversationView(requested, requestedOrder);

      if (actualView !== view) {
        redirect(
          buildChatHref({
            view: actualView,

            type: filter,

            conversation: requested.id,
          }),
        );
      }
    }
  }

  const viewConversations = groups[view];

  const filteredConversations = viewConversations.filter((conversation) =>
    matchesType(conversation, filter),
  );

  /* =======================================================
     SELECTED
  ======================================================= */

  const selected =
    filteredConversations.find(
      (conversation) => conversation.id === params.conversation,
    ) ?? null;

  const selectedOrder = selected
    ? (getOrder(selected, orderMap) ?? null)
    : null;

  /* =======================================================
     MESSAGES / PAYMENTS
  ======================================================= */

  let messages: AdminLiveMessage[] = [];

  let paymentRequests: AdminLivePaymentRequest[] = [];

  if (selected && view !== "deleted") {
    const [messageResult, paymentResult] = await Promise.all([
      supabase
        .from("service_messages")
        .select(
          "id, conversation_id, sender_type, sender_label, body, message_type, metadata, created_at",
        )
        .eq("conversation_id", selected.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100),

      supabase
        .from("service_payment_requests")
        .select(
          "id, conversation_id, order_id, amount, currency, title, description, status, refund_status, refunded_amount, stripe_checkout_session_id, paid_at, cancelled_at, created_at",
        )
        .eq("conversation_id", selected.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100),
    ]);

    if (messageResult.error) {
      throw new Error(
        `Unable to load messages: Please retry or contact the owner.`,
      );
    }

    if (paymentResult.error) {
      throw new Error(
        `Unable to load payment requests: Please retry or contact the owner.`,
      );
    }

    messages = (
      messageResult.data ?? []
    ).reverse() as unknown as AdminLiveMessage[];

    paymentRequests = (paymentResult.data ??
      []) as unknown as AdminLivePaymentRequest[];

    if (isUnread(selected)) {
      await supabase
        .from("service_conversations")
        .update({
          admin_last_read_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
    }
  }

  const latestPayment =
    paymentRequests.length > 0
      ? paymentRequests[paymentRequests.length - 1]
      : null;

  const pendingPayment =
    paymentRequests.find((request) => request.status === "pending") ?? null;

  const paidPayment =
    [...paymentRequests]
      .reverse()
      .find((request) => request.status === "paid") ?? null;

  /* =======================================================
     SELECTED LABELS
  ======================================================= */

  const selectedReference = selected
    ? getReference(selected, selectedOrder ?? undefined)
    : "";

  const selectedTitle = selected
    ? getTitle(selected, selectedOrder ?? undefined)
    : "";

  const selectedSubtitle = selected
    ? getSubtitle(selected, selectedOrder ?? undefined)
    : "";

  const selectedCustomer = selected
    ? getCustomerName(selected, selectedOrder ?? undefined)
    : "";

  const selectedContact = selected
    ? getCustomerContact(selected, selectedOrder ?? undefined)
    : "";

  const paymentStatus =
    selectedOrder?.payment_status ??
    paidPayment?.status ??
    pendingPayment?.status ??
    "not_requested";

  const workflowStatus =
    selectedOrder?.service_status ?? selected?.workflow_status ?? "new";

  /* =======================================================
     COUNTS
  ======================================================= */

  function countForView(targetView: ChatView) {
    return groups[targetView].length;
  }

  function countType(type: ConversationFilter) {
    return viewConversations.filter((conversation) =>
      matchesType(conversation, type),
    ).length;
  }

  function unreadType(type: ConversationFilter) {
    return viewConversations.filter(
      (conversation) =>
        matchesType(conversation, type) && isUnread(conversation),
    ).length;
  }

  /* =======================================================
     ARCHIVE VIEWS
  ======================================================= */

  const isArchiveView = view === "closed" || view === "deleted";

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className={styles.page}>
      <AdminSidebar />

      <AdminChatQueueSync />

      <section className={styles.content}>
        {/* =================================================
            HEADER
        ================================================= */}

        <header className={styles.header}>
          <div>
            <span>BIRDSHOP / COMMUNICATION</span>

            <h1>Chat</h1>

            <p>
              New conversations stay visible first, active work is separated by
              provider, and verified payments move automatically into Completed.
            </p>
          </div>

          <AdminRefreshButton />
        </header>

        <nav
          aria-label="Conversation pages"
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            margin: "20px 0",
          }}
        >
          {page > 1 && (
            <Link href={pageHref(page - 1)}>← Newer conversations</Link>
          )}
          <span>
            History page {page} · tab counts cover these 100 conversations
          </span>
          {allConversations.length === 100 && (
            <Link href={pageHref(page + 1)}>Older conversations →</Link>
          )}
        </nav>
        {params.message && (
          <div
            className={params.tone === "error" ? styles.error : styles.notice}
          >
            {params.message}
          </div>
        )}

        {/* =================================================
            WORKFLOW TABS
        ================================================= */}

        <nav className={styles.workflowTabs}>
          {(
            [
              ["new", "New"],
              ["progress", "In Progress"],
              ["completed", "Completed"],
              ["closed", "Closed"],
              ["deleted", "Deleted"],
            ] as Array<[ChatView, string]>
          ).map(([target, label]) => (
            <Link
              key={target}
              href={buildChatHref({
                view: target,

                type: filter,
              })}
              className={
                view === target ? styles.workflowTabActive : styles.workflowTab
              }
            >
              <span>{label}</span>

              <strong>{countForView(target)}</strong>
            </Link>
          ))}
        </nav>

        {/* =================================================
            CATEGORY FILTERS
        ================================================= */}

        <nav className={styles.categoryTabs}>
          {(
            [
              ["all", "All"],
              ["service", "Service"],
              ["product", "Product Support"],
              ["general", "General Support"],
            ] as Array<[ConversationFilter, string]>
          ).map(([target, label]) => {
            const unread = unreadType(target);

            return (
              <Link
                key={target}
                href={buildChatHref({
                  view,

                  type: target,
                })}
                className={
                  filter === target
                    ? styles.categoryTabActive
                    : styles.categoryTab
                }
              >
                {label}

                <span>
                  {countType(target)}

                  {unread > 0 ? ` · ${unread} new` : ""}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* =================================================
            ARCHIVES
        ================================================= */}

        {isArchiveView ? (
          <section className={styles.archive}>
            <div className={styles.archiveHeader}>
              <div>
                <span>{viewLabel(view).toUpperCase()}</span>

                <h2>
                  {filteredConversations.length}{" "}
                  {filteredConversations.length === 1
                    ? "conversation"
                    : "conversations"}
                </h2>
              </div>

              <p>
                {view === "deleted"
                  ? "Deleted conversations remain recoverable until permanently removed."
                  : "Closed conversations are retained for reference and can be reopened."}
              </p>
            </div>

            {filteredConversations.length === 0 ? (
              <div className={styles.emptyArchive}>Nothing is stored here.</div>
            ) : (
              <div className={styles.archiveGrid}>
                {filteredConversations.map((conversation) => {
                  const order = getOrder(conversation, orderMap);

                  return (
                    <article
                      key={conversation.id}
                      className={styles.archiveCard}
                    >
                      <div className={styles.archiveTop}>
                        <span>
                          {conversationTypeLabel(
                            conversation.conversation_type,
                          )}
                        </span>

                        <time>{formatDate(conversation.last_message_at)}</time>
                      </div>

                      <strong className={styles.chatReference}>{getReference(conversation, order)}</strong>

                      <h3>{getTitle(conversation, order)}</h3>

                      <p>
                        {getCustomerName(conversation, order)}
                        {" · "}
                        {getSubtitle(conversation, order)}
                      </p>

                      <div className={styles.archiveActions}>
                        {view === "closed" ? (
                          <>
                            <form action={setConversationStatus}>
                              <input
                                type="hidden"
                                name="conversation_id"
                                value={conversation.id}
                              />

                              <SubmitButton
                                type="submit"
                                name="status"
                                value="open"
                              >
                                Reopen
                              </SubmitButton>
                            </form>

                            <form action={deleteConversation}>
                              <input type="hidden" name="return_view" value={view} />
                              <input type="hidden" name="return_type" value={filter} />
                              <input type="hidden" name="return_page" value={page} />
                              <input
                                type="hidden"
                                name="conversation_id"
                                value={conversation.id}
                              />

                              <SubmitButton
                                type="submit"
                                className={styles.dangerButton}
                              >
                                Delete
                              </SubmitButton>
                            </form>
                          </>
                        ) : (
                          <>
                            <form action={restoreConversation}>
                              <input type="hidden" name="return_view" value={view} />
                              <input type="hidden" name="return_type" value={filter} />
                              <input type="hidden" name="return_page" value={page} />
                              <input
                                type="hidden"
                                name="conversation_id"
                                value={conversation.id}
                              />

                              <SubmitButton type="submit">Restore</SubmitButton>
                            </form>


                          </>
                        )}
                        <PermanentChatDelete id={conversation.id} reference={getReference(conversation, order)} view={view} type={filter} page={page} />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          /* =================================================
             ACTIVE WORKSPACE
          ================================================= */

          <div
            className={styles.workspace}
            data-mobile-detail={Boolean(params.conversation)}
          >
            {/* ===============================================
                INBOX
            =============================================== */}

            <aside className={styles.inbox}>
              <div className={styles.inboxHeading}>
                <div>
                  <span>{viewLabel(view).toUpperCase()}</span>

                  <strong>{filterLabel(filter)}</strong>
                </div>

                <b>{filteredConversations.length}</b>
              </div>

              {filteredConversations.length === 0 ? (
                <div className={styles.emptyInbox}>
                  No {viewLabel(view).toLowerCase()}{" "}
                  {filterLabel(filter).toLowerCase()} conversations.
                </div>
              ) : (
                <div className={styles.conversationList}>
                  {filteredConversations.map((conversation) => {
                    const order = getOrder(conversation, orderMap);

                    const unread = isUnread(conversation);

                    const palette = staffPalette(conversation);

                    const provider = staffLabel(conversation);

                    return (
                      <Link
                        key={conversation.id}
                        href={buildChatHref({
                          view,

                          type: filter,

                          conversation: conversation.id,
                        })}
                        className={`${styles.conversationCard} ${
                          selected?.id === conversation.id
                            ? styles.conversationCardSelected
                            : ""
                        }`}
                        data-palette={palette}
                        data-assigned={provider ? "true" : "false"}
                      >
                        <div className={styles.conversationCardTop}>
                          <span>
                            {conversationTypeLabel(
                              conversation.conversation_type,
                            )}

                          </span>

                          <div className={styles.cardBadges}>
                            {unread && (
                              <small className={styles.newBadge}>NEW</small>
                            )}

                            {provider && (
                              <small className={styles.providerBadge}>
                                {provider}
                              </small>
                            )}
                          </div>
                        </div>

                        <span className={styles.chatReference}>{getReference(conversation, order)}</span>
                        <strong>{getTitle(conversation, order)}</strong>

                        <p>
                          {getCustomerName(conversation, order)}
                          {" · "}
                          {getSubtitle(conversation, order)}
                        </p>

                        <div className={styles.cardBottom}>
                          <time>
                            {formatDate(conversation.last_message_at)}
                          </time>

                          {view === "completed" && order && (
                            <span>{statusLabel(order.service_status)}</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* ===============================================
                CHAT
            =============================================== */}

            {!selected ? (
              <section className={styles.emptyChat}>
                <span>{viewLabel(view)}</span>

                <h2>Choose a conversation.</h2>

                <p>
                  Select a conversation from the list to view its messages and
                  actions.
                </p>
              </section>
            ) : (
              <section className={styles.chat}>
                <Link
                  className={styles.mobileBack}
                  href={buildChatHref({ view, type: filter })}
                >
                  ← Conversations
                </Link>
                {/* ===========================================
                    CHAT HEADER
                =========================================== */}

                <header className={styles.chatHeader}>
                  <div className={styles.chatIdentity}>
                    <span>
                      {conversationTypeLabel(selected.conversation_type)}

                    </span>

                    <strong className={styles.chatReference}>{selectedReference}</strong>
                    <h2>{selectedTitle}</h2>

                    <p>{selectedSubtitle}</p>
                  </div>

                  <div className={styles.chatFacts}>
                    <div>
                      <span>WORKSPACE</span>

                      <strong>{viewLabel(view)}</strong>
                    </div>

                    {selected.conversation_type === "service" && (
                      <>
                        <div>
                          <span>PAYMENT</span>

                          <strong>{statusLabel(paymentStatus)}</strong>
                        </div>

                        <div>
                          <span>SERVICE</span>

                          <strong>{statusLabel(workflowStatus)}</strong>
                        </div>
                      </>
                    )}
                  </div>
                </header>

                {/* ===========================================
                    CUSTOMER BAR
                =========================================== */}

                <div className={styles.customerBar}>
                  <div>
                    <span>CUSTOMER</span>

                    <strong>{selectedCustomer}</strong>

                    <small>{selectedContact}</small>
                  </div>

                  <div className={styles.customerActions}>
                    <PermanentChatDelete id={selected.id} reference={selectedReference} view={view} type={filter} page={page} />
                    {selected.assigned_to && (
                      <span
                        className={styles.assignedChip}
                        data-palette={staffPalette(selected)}
                      >
                        Assigned to {selected.assigned_to}
                      </span>
                    )}
                  </div>
                </div>

                {/* ===========================================
                    OWNER CLAIM

                    Service only.
                =========================================== */}

                {view === "new" &&
                  selected.conversation_type === "service" &&
                  !selected.assigned_staff_user_id && (
                    <div className={styles.claimBar}>
                      <div>
                        <span>UNASSIGNED SERVICE</span>

                        <p>
                          Take ownership as the BirdShop owner, or leave it
                          available for Service Staff.
                        </p>
                      </div>

                      <form action={acceptServiceConversation}>
                        <input
                          type="hidden"
                          name="conversation_id"
                          value={selected.id}
                        />

                        <SubmitButton type="submit">Take Service</SubmitButton>
                      </form>
                    </div>
                  )}

                {/* ===========================================
                    PAYMENT CENTER
                =========================================== */}

                {selected.conversation_type === "service" && (
                  <>
                    <PaymentFeedback
                      key={selected.id}
                      conversationId={selected.id}
                    />
                    <details
                      className={paymentStyles.paymentDrawer}
                      key={selected.id}
                    >
                      <summary>
                        <div>
                          <span>PAYMENT CENTER</span>

                          <strong>
                            {paidPayment
                              ? `${paymentLabel(paidPayment)} · ${money(
                                  paidPayment.amount,
                                  paidPayment.currency,
                                )}`
                              : pendingPayment
                                ? `Pending · ${money(
                                    pendingPayment.amount,
                                    pendingPayment.currency,
                                  )}`
                                : latestPayment
                                  ? statusLabel(latestPayment.status)
                                  : "No payment request"}
                          </strong>
                        </div>

                        <span className={paymentStyles.toggle}>
                          {paidPayment || pendingPayment || selectedOrder
                            ? "View details"
                            : "Create request"}
                          <span aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </span>
                        </span>
                      </summary>

                      <div className={paymentStyles.paymentBody}>
                        {paidPayment ? (
                          <article className={paymentStyles.paidSummary}>
                            <div>
                              <span>{paymentLabel(paidPayment)}</span>

                              <strong>{paidPayment.title}</strong>
                              {Number(paidPayment.refunded_amount ?? 0) > 0 && (
                                <p>
                                  Refunded{" "}
                                  {money(
                                    paidPayment.refunded_amount ?? 0,
                                    paidPayment.currency,
                                  )}
                                </p>
                              )}

                              <p>
                                The payment is verified and the linked service
                                order has been created.
                              </p>
                            </div>

                            <b>
                              {money(paidPayment.amount, paidPayment.currency)}
                            </b>
                          </article>
                        ) : pendingPayment ? (
                          <article
                            className={paymentStyles.request}
                            data-status="pending"
                          >
                            <div className={paymentStyles.requestTop}>
                              <div>
                                <span className={paymentStyles.requestEyebrow}>
                                  CURRENT PAYMENT REQUEST
                                </span>

                                <strong className={paymentStyles.requestTitle}>
                                  {pendingPayment.title}
                                </strong>
                              </div>

                              <span className={paymentStyles.requestStatus}>
                                Pending
                              </span>
                            </div>

                            {pendingPayment.description && (
                              <p className={paymentStyles.requestDescription}>
                                {pendingPayment.description}
                              </p>
                            )}

                            <strong className={paymentStyles.requestAmount}>
                              {money(
                                pendingPayment.amount,
                                pendingPayment.currency,
                              )}
                            </strong>

                            <div className={paymentStyles.requestFooter}>
                              <span>Waiting for customer payment.</span>

                              <PaymentActionForm action={cancelPaymentRequest}>
                                <input
                                  type="hidden"
                                  name="conversation_id"
                                  value={selected.id}
                                />

                                <input
                                  type="hidden"
                                  name="payment_request_id"
                                  value={pendingPayment.id}
                                />

                                <SubmitButton
                                  type="submit"
                                  className={paymentStyles.secondaryButton}
                                >
                                  Cancel Request
                                </SubmitButton>
                              </PaymentActionForm>
                            </div>
                          </article>
                        ) : selectedOrder ? (
                          <div className={paymentStyles.noPaymentAction}>
                            This conversation already has a linked order.
                          </div>
                        ) : (
                          <PaymentActionForm
                            action={createPaymentRequest}
                            className={paymentStyles.form}
                          >
                            <input
                              type="hidden"
                              name="conversation_id"
                              value={selected.id}
                            />

                            <div className={paymentStyles.fields}>
                              <label className={paymentStyles.field}>
                                <span className={paymentStyles.fieldLabel}>
                                  TITLE
                                </span>

                                <input
                                  className={paymentStyles.input}
                                  name="title"
                                  defaultValue={`${selectedTitle}${
                                    selectedSubtitle
                                      ? ` — ${selectedSubtitle}`
                                      : ""
                                  }`}
                                  maxLength={180}
                                  required
                                />
                              </label>

                              <label className={paymentStyles.field}>
                                <span className={paymentStyles.fieldLabel}>
                                  AMOUNT
                                </span>

                                <input
                                  className={paymentStyles.input}
                                  name="amount"
                                  type="number"
                                  min="0.50"
                                  step="0.01"
                                  placeholder="24.99"
                                  required
                                />
                              </label>
                            </div>

                            <label className={paymentStyles.field}>
                              <span className={paymentStyles.fieldLabel}>
                                DESCRIPTION · OPTIONAL
                              </span>

                              <textarea
                                className={paymentStyles.textarea}
                                name="description"
                                rows={2}
                                maxLength={2000}
                                placeholder="What is included in this service?"
                              />
                            </label>

                            <div className={paymentStyles.actions}>
                              <span>
                                A fixed-amount checkout appears in the
                                customer’s chat.
                              </span>

                              <SubmitButton
                                type="submit"
                                className={paymentStyles.button}
                              >
                                Send Payment Request
                              </SubmitButton>
                            </div>
                          </PaymentActionForm>
                        )}
                      </div>
                    </details>
                  </>
                )}

                {/* ===========================================
                    LIVE THREAD

                    Completed/Paid is still live because paid
                    does NOT mean the actual service work is
                    necessarily finished.
                =========================================== */}

                <div className={styles.liveThread}>
                  <AdminLiveThread
                    key={selected.id}
                    conversationId={selected.id}
                    initialMessages={messages}
                    initialPaymentRequests={paymentRequests}
                  />
                </div>

                {/* ===========================================
                    FOOTER
                =========================================== */}

                <footer className={styles.chatFooter}>
                  <div>
                    <form action={setConversationStatus}>
                      <input
                        type="hidden"
                        name="conversation_id"
                        value={selected.id}
                      />

                      <SubmitButton type="submit" name="status" value="closed">
                        Close Conversation
                      </SubmitButton>
                    </form>
                  </div>

                  {selectedOrder ? (
                    <Link href="/admin/orders?view=services">
                      Open Service Order →
                    </Link>
                  ) : (
                    <span>No order created yet</span>
                  )}
                </footer>
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
