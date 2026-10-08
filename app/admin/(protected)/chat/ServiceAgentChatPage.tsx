import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";

import AdminSidebar from "@/components/AdminSidebar";

import { createClient } from "@/lib/supabase/server";

import {
  acceptServiceConversation,
  cancelServiceAgentPaymentRequest,
  createServiceAgentPaymentRequest,
  leaveServiceConversation,
} from "./agent-actions";

import AdminLiveThread, {
  type AdminLiveMessage as ServiceAgentMessage,
  type AdminLivePaymentRequest,
} from "./AdminLiveThread";
import PaymentActionForm, { PaymentFeedback } from "./PaymentActionForm";

import paymentStyles from "@/components/ChatPaymentUI.module.css";
import completeStyles from "./OwnerAdminChatPage.module.css";
import { completeServiceOrderFromChat } from "./actions";
import styles from "./chat.module.css";

/* =========================================================
   TYPES
========================================================= */

type StaffProfile = {
  user_id: string;

  role: "service_agent";

  display_name: string | null;

  is_active: boolean;
};

type QueueConversation = {
  id: string;

  reference: string;

  workflow_status: string;

  status: string;

  last_message_at: string;

  last_sender_type: string | null;

  customer_name: string | null;

  subject: string | null;

  service_name: string | null;

  package_name: string | null;

  request_message: string | null;

  assigned_staff_user_id: string | null;

  assigned_to: string | null;

  assigned_at: string | null;

  is_mine: boolean;

  is_unassigned: boolean;
};

type ConversationDetail = {
  id: string;

  order_id: string | null;

  reference: string;

  conversation_type: "service";

  workflow_status: string;

  status: string;

  last_message_at: string;

  last_sender_type: string | null;

  admin_last_read_at: string | null;

  customer_name: string | null;

  customer_email: string | null;

  customer_contact: string | null;

  subject: string | null;

  request_message: string | null;

  service_name: string | null;

  package_name: string | null;

  assigned_staff_user_id: string;

  assigned_to: string | null;

  assigned_at: string | null;
};

type PaymentRequest = {
  id: string;

  conversation_id: string;

  order_id: string | null;

  amount: number | string;

  currency: string;

  title: string;

  description: string | null;

  status: "pending" | "paid" | "cancelled" | "expired";

  stripe_checkout_session_id: string | null;

  stripe_payment_status: string | null;

  refund_status: string | null;

  refunded_amount: number | string | null;

  paid_at: string | null;

  cancelled_at: string | null;

  created_at: string;
};

type PageProps = {
  searchParams: Promise<{
    conversation?: string;
    page?: string;
  }>;
};

/* =========================================================
   HELPERS
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

function statusLabel(value: string | null | undefined) {
  return (value ?? "new")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function conversationTitle(conversation: QueueConversation) {
  return (
    conversation.service_name ||
    conversation.subject ||
    "Custom Service Request"
  );
}

function conversationSubtitle(conversation: QueueConversation) {
  return conversation.package_name || "Custom Quote";
}

function conversationHref(id: string, page: number) {
  const params = new URLSearchParams();

  params.set("view", "active");

  params.set("type", "service");

  params.set("conversation", id);
  params.set("page", String(page));

  return `/admin/chat?${params.toString()}`;
}

function isUnread(conversation: QueueConversation) {
  return conversation.last_sender_type === "customer";
}

/* =========================================================
   PAGE
========================================================= */

export default async function ServiceAgentChatPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(100000, Number(params.page) || 1));

  const supabase = await createClient();

  /* =======================================================
     STAFF
  ======================================================= */

  const { data: profileData } = await supabase.rpc(
    "birdshop_get_my_staff_profile",
  );

  const profile = profileData as StaffProfile;

  const staffName = profile?.display_name?.trim() || "Service Staff";

  /* =======================================================
     SAFE QUEUE

     This returns:
       - unassigned services
       - this employee's services

     It does NOT expose other employees' services.
  ======================================================= */

  const {
    data: queueData,

    error: queueError,
  } = await supabase
    .rpc("birdshop_staff_list_service_queue")
    .range((page - 1) * 100, page * 100 - 1);

  if (queueError) {
    throw new Error(`Unable to load service queue: Please refresh and retry.`);
  }

  const queue = (queueData ?? []) as QueueConversation[];

  const available = queue.filter((conversation) => conversation.is_unassigned);

  const mine = queue.filter((conversation) => conversation.is_mine);

  /* =======================================================
     SELECTED
  ======================================================= */

  const requested = params.conversation
    ? (queue.find((conversation) => conversation.id === params.conversation) ??
      null)
    : null;

  const selected = requested ?? null;

  const selectedIsMine = selected?.is_mine === true;

  /* =======================================================
     FULL CONVERSATION

     ONLY AVAILABLE AFTER THE AGENT OWNS IT.
  ======================================================= */

  let detail: ConversationDetail | null = null;

  let messages: ServiceAgentMessage[] = [];

  let paymentRequests: PaymentRequest[] = [];

  if (selected && selectedIsMine) {
    const {
      data: detailData,

      error: detailError,
    } = await supabase
      .from("service_conversations")
      .select(
        `
            id,
            order_id,
            reference,
            conversation_type,
            workflow_status,
            status,
            last_message_at,
            last_sender_type,
            admin_last_read_at,
            customer_name,
            customer_email,
            customer_contact,
            subject,
            request_message,
            service_name,
            package_name,
            assigned_staff_user_id,
            assigned_to,
            assigned_at
          `,
      )
      .eq("id", selected.id)
      .maybeSingle();

    if (detailError) {
      throw new Error(`Unable to load service: Please refresh and retry.`);
    }

    detail = detailData as ConversationDetail | null;

    if (detail) {
      const [messageResult, paymentResult] = await Promise.all([
        supabase
          .from("service_messages")
          .select(
            "id, conversation_id, sender_type, sender_label, body, message_type, metadata, created_at",
          )
          .eq("conversation_id", detail.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(100),

        supabase
          .from("service_payment_requests")
          .select(
            `
                id,
                conversation_id,
                order_id,
                amount,
                currency,
                title,
                description,
                status,
                stripe_checkout_session_id,
                stripe_payment_status,
                refund_status,
                refunded_amount,
                paid_at,
                cancelled_at,
                created_at
              `,
          )
          .eq("conversation_id", detail.id)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (messageResult.error) {
        throw new Error(
          `Unable to load messages: Please retry or contact the owner.`,
        );
      }

      if (paymentResult.error) {
        throw new Error(
          `Unable to load payments: Please retry or contact the owner.`,
        );
      }

      messages = (
        messageResult.data ?? []
      ).reverse() as unknown as ServiceAgentMessage[];

      paymentRequests = (paymentResult.data ??
        []) as unknown as PaymentRequest[];

      if (detail.last_sender_type === "customer") {
        await supabase.rpc("birdshop_staff_mark_service_chat_read", {
          p_conversation_id: detail.id,
        });
      }
    }
  }

  /* =======================================================
     PAYMENT STATE
  ======================================================= */

  const pendingPayment =
    paymentRequests.find((payment) => payment.status === "pending") ?? null;

  const paidPayment =
    paymentRequests.find((payment) => payment.status === "paid") ?? null;

  const latestPayment = paymentRequests[0] ?? null;

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className={styles.page}>
      <AdminSidebar role="service_agent" />

      <section className={styles.content}>
        {/* =================================================
            HEADER
        ================================================= */}

        <header className={styles.header}>
          <div>
            <span>BIRDSHOP / SERVICE STAFF</span>

            <h1>Service Desk</h1>

            <p>
              Accept available service requests, work directly with customers,
              and send secure BirdShop payment requests.
            </p>
          </div>
        </header>
        <nav
          aria-label="Service queue pages"
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            margin: "20px 0",
          }}
        >
          {page > 1 && (
            <Link href={`/admin/chat?page=${page - 1}`}>← Previous</Link>
          )}
          <span>Queue page {page} · up to 100 conversations</span>
          {queue.length === 100 && (
            <Link href={`/admin/chat?page=${page + 1}`}>Next →</Link>
          )}
        </nav>

        {/* =================================================
            STATUS
        ================================================= */}

        <div className={styles.paymentBar}>
          <div className={styles.paymentBarInfo}>
            <span>SIGNED IN</span>

            <strong>{staffName}</strong>
          </div>

          <span>
            {available.length} AVAILABLE
            {" · "}
            {mine.length} MINE
          </span>
        </div>

        {/* =================================================
            WORKSPACE
        ================================================= */}

        <div
          className={styles.workspace}
          data-mobile-detail={Boolean(params.conversation)}
        >
          {/* ===============================================
              QUEUE
          =============================================== */}

          <aside className={styles.inbox}>
            {/* =============================================
                AVAILABLE
            ============================================= */}

            <div className={styles.inboxHeading}>
              <span>AVAILABLE REQUESTS</span>

              <strong>{available.length}</strong>
            </div>

            {available.length === 0 ? (
              <div className={styles.emptyInbox}>
                No unassigned service requests.
              </div>
            ) : (
              <div className={styles.conversationList}>
                {available.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={conversationHref(conversation.id, page)}
                    className={`${styles.conversationItem} ${
                      selected?.id === conversation.id
                        ? styles.activeConversation
                        : ""
                    }`}
                  >
                    <div>
                      <span>AVAILABLE · {conversation.reference}</span>

                      {isUnread(conversation) && <small>NEW</small>}
                    </div>

                    <strong>{conversationTitle(conversation)}</strong>

                    <p>
                      {conversation.customer_name || "Customer"}

                      {" · "}

                      {conversationSubtitle(conversation)}
                    </p>

                    <time>{formatDate(conversation.last_message_at)}</time>
                  </Link>
                ))}
              </div>
            )}

            {/* =============================================
                MY SERVICES
            ============================================= */}

            <div
              className={styles.inboxHeading}
              style={{
                marginTop: "18px",
              }}
            >
              <span>MY SERVICES</span>

              <strong>{mine.length}</strong>
            </div>

            {mine.length === 0 ? (
              <div className={styles.emptyInbox}>
                You have not accepted a service yet.
              </div>
            ) : (
              <div className={styles.conversationList}>
                {mine.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={conversationHref(conversation.id, page)}
                    className={`${styles.conversationItem} ${
                      selected?.id === conversation.id
                        ? styles.activeConversation
                        : ""
                    }`}
                    style={{
                      borderLeft: "3px solid #82927a",

                      background:
                        selected?.id === conversation.id
                          ? undefined
                          : "rgba(114, 135, 105, 0.08)",
                    }}
                  >
                    <div>
                      <span>MY SERVICE · {conversation.reference}</span>

                      <small>YOURS</small>
                    </div>

                    <strong>{conversationTitle(conversation)}</strong>

                    <p>
                      {conversation.customer_name || "Customer"}

                      {" · "}

                      {conversationSubtitle(conversation)}
                    </p>

                    <time>{formatDate(conversation.last_message_at)}</time>
                  </Link>
                ))}
              </div>
            )}
          </aside>

          {/* ===============================================
              EMPTY
          =============================================== */}

          {!selected ? (
            <section className={styles.emptyChat}>
              There are no service requests waiting.
            </section>
          ) : !selectedIsMine ? (
            /* =============================================
               AVAILABLE REQUEST PREVIEW
            ============================================= */

            <section className={styles.chat}>
              <Link
                className={styles.mobileBack}
                href="/admin/chat?view=active&type=service"
              >
                ← Conversations
              </Link>
              <header className={styles.chatHeader}>
                <div>
                  <span>AVAILABLE · {selected.reference}</span>

                  <h2>{conversationTitle(selected)}</h2>

                  <p>{conversationSubtitle(selected)}</p>
                </div>

                <div className={styles.orderFacts}>
                  <div>
                    <span>STATUS</span>

                    <strong>Waiting</strong>
                  </div>

                  <div>
                    <span>ASSIGNED</span>

                    <strong>No</strong>
                  </div>
                </div>
              </header>

              <div className={styles.customerBar}>
                <div>
                  <span>CUSTOMER</span>

                  <strong>{selected.customer_name || "Customer"}</strong>

                  <small>Contact details unlock after acceptance.</small>
                </div>

                <span>{selected.reference}</span>
              </div>

              <section className={paymentStyles.panel}>
                <div className={paymentStyles.panelHeader}>
                  <div>
                    <span className={paymentStyles.panelEyebrow}>
                      AVAILABLE SERVICE
                    </span>

                    <strong className={paymentStyles.panelTitle}>
                      Accept this request?
                    </strong>
                  </div>

                  <p className={paymentStyles.panelCopy}>
                    Once accepted, this conversation becomes yours and
                    disappears from other Service Agents&apos; queues.
                  </p>
                </div>

                <div
                  style={{
                    padding: "18px 0 24px",

                    fontFamily: "Georgia, 'Times New Roman', serif",

                    fontSize: "13px",

                    lineHeight: 1.7,

                    color: "#4d584c",
                  }}
                >
                  {selected.request_message ||
                    "The customer did not include additional request details."}
                </div>

                <form action={acceptServiceConversation}>
                  <input
                    type="hidden"
                    name="conversation_id"
                    value={selected.id}
                  />

                  <SubmitButton type="submit" className={paymentStyles.button}>
                    Accept Service
                  </SubmitButton>
                </form>
              </section>

              <footer className={styles.chatFooter}>
                <span>
                  Accepting automatically introduces you to the customer.
                </span>
              </footer>
            </section>
          ) : !detail ? (
            <section className={styles.emptyChat}>
              Unable to load the accepted service.
            </section>
          ) : (
            /* =============================================
               MY SERVICE
            ============================================= */

            <section className={styles.chat}>
              <Link
                className={styles.mobileBack}
                href="/admin/chat?view=active&type=service"
              >
                ← Conversations
              </Link>
              {/* ===========================================
                  HEADER
              =========================================== */}

              <header className={styles.chatHeader}>
                <div>
                  <span>MY SERVICE · {detail.reference}</span>

                  <h2>
                    {detail.service_name ||
                      detail.subject ||
                      "Custom Service Request"}
                  </h2>

                  <p>{detail.package_name || "Custom Quote"}</p>
                </div>

                <div className={styles.orderFacts}>
                  <div>
                    <span>STATUS</span>

                    <strong>{statusLabel(detail.workflow_status)}</strong>
                  </div>

                  <div>
                    <span>PROVIDER</span>

                    <strong>{detail.assigned_to || staffName}</strong>
                  </div>

                  <div>
                    <span>PAYMENT</span>

                    <strong>
                      {latestPayment
                        ? statusLabel(
                            latestPayment.refund_status &&
                              latestPayment.refund_status !== "none"
                              ? latestPayment.refund_status === "full"
                                ? "refunded"
                                : "partially_refunded"
                              : latestPayment.status,
                          )
                        : "Not Sent"}
                    </strong>
                  </div>
                </div>
              </header>

              {/* ===========================================
                  CUSTOMER
              =========================================== */}

              <div className={styles.customerBar}>
                <div>
                  <span>CUSTOMER</span>

                  <strong>{detail.customer_name || "Customer"}</strong>

                  <small>
                    {detail.customer_contact ||
                      detail.customer_email ||
                      "No customer contact"}
                  </small>
                </div>

                <span>{detail.reference}</span>
              </div>

              {/* ===========================================
                  ASSIGNMENT
              =========================================== */}

              <div className={styles.paymentBar}>
                <div className={styles.paymentBarInfo}>
                  <span>ASSIGNED TO YOU</span>

                  <strong>{detail.assigned_to || staffName}</strong>
                </div>

                <form action={leaveServiceConversation}>
                  <input
                    type="hidden"
                    name="conversation_id"
                    value={detail.id}
                  />

                  <SubmitButton
                    type="submit"
                    className={paymentStyles.secondaryButton}
                  >
                    Leave Service
                  </SubmitButton>
                </form>
              </div>

              {/* ===========================================
                  PAYMENT CENTER
              =========================================== */}

              <details className={styles.paymentDrawer}>
                <summary>
                  Payment center <span aria-hidden="true">⌄</span>
                </summary>
                <div className={paymentStyles.panel}>
                  <div className={paymentStyles.panelHeader}>
                    <div>
                      <span className={paymentStyles.panelEyebrow}>
                        PAYMENT CENTER
                      </span>

                      <strong className={paymentStyles.panelTitle}>
                        {paidPayment
                          ? paidPayment.refund_status === "full"
                            ? "Payment refunded"
                            : paidPayment.refund_status === "partial"
                              ? "Payment partially refunded"
                              : "Payment received"
                          : pendingPayment
                            ? "Payment request pending"
                            : "Send secure payment request"}
                      </strong>
                    </div>

                    <p className={paymentStyles.panelCopy}>
                      {paidPayment
                        ? "BirdShop has recorded the customer's payment."
                        : "The customer receives a secure Stripe Checkout button inside their private conversation."}
                    </p>
                  </div>

                  {paidPayment ? (
                    <article
                      style={{
                        padding: "18px 0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",

                          justifyContent: "space-between",

                          gap: "20px",

                          alignItems: "center",
                        }}
                      >
                        <div>
                          <span className={paymentStyles.fieldLabel}>
                            {paidPayment.title}
                          </span>

                          <div
                            style={{
                              marginTop: "7px",

                              fontFamily: "Georgia, 'Times New Roman', serif",

                              fontSize: "30px",

                              color: "#263126",
                            }}
                          >
                            {money(paidPayment.amount, paidPayment.currency)}
                          </div>
                        </div>

                        <strong>
                          {paidPayment.refund_status === "full"
                            ? "REFUNDED"
                            : paidPayment.refund_status === "partial"
                              ? "PARTIALLY REFUNDED"
                              : "PAID"}
                        </strong>
                      </div>

                      {Number(paidPayment.refunded_amount ?? 0) > 0 && (
                        <p>
                          Refunded:{" "}
                          {money(
                            Number(paidPayment.refunded_amount),
                            paidPayment.currency,
                          )}
                        </p>
                      )}
                    </article>
                  ) : pendingPayment ? (
                    <article
                      style={{
                        padding: "18px 0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",

                          justifyContent: "space-between",

                          gap: "20px",

                          alignItems: "center",
                        }}
                      >
                        <div>
                          <span className={paymentStyles.fieldLabel}>
                            {pendingPayment.title}
                          </span>

                          <div
                            style={{
                              marginTop: "7px",

                              fontFamily: "Georgia, 'Times New Roman', serif",

                              fontSize: "30px",

                              color: "#263126",
                            }}
                          >
                            {money(
                              pendingPayment.amount,
                              pendingPayment.currency,
                            )}
                          </div>
                        </div>

                        <strong>PENDING</strong>
                      </div>

                      {pendingPayment.description && (
                        <p>{pendingPayment.description}</p>
                      )}

                      <div className={paymentStyles.requestFooter}>
                        <span>Waiting for customer payment.</span>

                        <PaymentActionForm
                          action={cancelServiceAgentPaymentRequest}
                        >
                          <input
                            type="hidden"
                            name="conversation_id"
                            value={detail.id}
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
                  ) : detail.order_id ? (
                    <div
                      style={{
                        padding: "20px 0",

                        color: "#5c665a",

                        fontFamily: "Georgia, 'Times New Roman', serif",
                      }}
                    >
                      This service already has an order.
                    </div>
                  ) : (
                    <PaymentActionForm
                      action={createServiceAgentPaymentRequest}
                      className={paymentStyles.form}
                    >
                      <input
                        type="hidden"
                        name="conversation_id"
                        value={detail.id}
                      />

                      <div className={paymentStyles.fields}>
                        <label className={paymentStyles.field}>
                          <span className={paymentStyles.fieldLabel}>
                            TITLE
                          </span>

                          <input
                            className={paymentStyles.input}
                            name="title"
                            defaultValue={`${
                              detail.service_name || "BirdShop Service"
                            }${
                              detail.package_name
                                ? ` — ${detail.package_name}`
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
                          placeholder="Describe exactly what this payment covers..."
                        />
                      </label>

                      <div className={paymentStyles.actions}>
                        <span>The customer cannot change this amount.</span>

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

              {/* ===========================================
                  CHAT
              =========================================== */}

              <PaymentFeedback key={detail.id} conversationId={detail.id} />
              <AdminLiveThread
                staffMode
                initialPaymentRequests={
                  [...paymentRequests].reverse() as AdminLivePaymentRequest[]
                }
                key={detail.id}
                conversationId={detail.id}
                initialMessages={messages}
              />

              <footer className={styles.chatFooter}>
                <div className={styles.footerActions}>
                  <span>{staffName}</span>
                </div>

                {detail.order_id && detail.workflow_status === "completed" ? (
                  <span className={completeStyles.completeNote}>
                    ✓ Order completed · closes automatically 1 hour after
                    completion
                  </span>
                ) : detail.order_id && paidPayment ? (
                  <details className={completeStyles.completeOrder}>
                    <summary>Complete Order</summary>
                    <form action={completeServiceOrderFromChat}>
                      <input type="hidden" name="conversation_id" value={detail.id} />
                      <label>
                        <input type="checkbox" name="confirm" value="yes" required />
                        The work is finished. Email the customer that their
                        order is complete and close this chat in 1 hour.
                      </label>
                      <SubmitButton type="submit">Complete Order</SubmitButton>
                    </form>
                  </details>
                ) : (
                  <span>Owner access remains available at all times.</span>
                )}
              </footer>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
