"use client";
import { paymentLabel } from "@/lib/payment-display";

import {
  FormEvent,
  Fragment,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { playChatChime, unlockChatSound } from "@/lib/chat-sound";

import {
  clearServiceChatToken,
  readServiceChatToken,
  saveServiceChatToken,
  SERVICE_CHAT_LIVE_EVENT,
} from "@/lib/service-chat-session";
import { ArrowIcon, CheckIcon, CopyIcon } from "@/components/SiteIcons";
import CustomerInbox from "./CustomerInbox";
import DeviceChatAccess from "./DeviceChatAccess";
import Link from "next/link";
import {
  ChevronIcon,
  CloseIcon,
  LockIcon,
  SendIcon,
  Spinner,
  StatusChip,
} from "./ChatUI";
import ui from "./chat-ui.module.css";
import {
  chatStatus,
  formatClock,
  formatDay,
  formatShortDate,
  groupMessages,
  requestChipLabel,
  serviceSteps,
  typeLabel,
  useNow,
} from "./presentation";
import paymentStyles from "./ServiceChatPaymentUI.module.css";
import styles from "./service-chat.module.css";

/* =========================================================
   TYPES
========================================================= */

type ConversationType = "service" | "product" | "general";

type ChatMessage = {
  id: string;

  sender_type: "customer" | "admin" | "system";

  sender_label: string | null;

  body: string;

  message_type: "text" | "payment_request" | "system";

  metadata: Record<string, unknown>;

  created_at: string;
};

type PaymentRequest = {
  refund_status?: string | null;
  refunded_amount?: number | string | null;
  id: string;

  amount: number | string;

  currency: string;

  title: string;

  description: string | null;

  status: "pending" | "paid" | "cancelled" | "expired";

  created_at: string;

  paid_at: string | null;
};

type ChatData = {
  conversation_id: string;

  reference: string;

  conversation_type: ConversationType;

  workflow_status: string;

  conversation_status: string;

  subject: string | null;

  customer_name: string;

  customer_email: string | null;

  customer_contact: string | null;

  service_name: string | null;

  package_name: string | null;

  product_name: string | null;

  product_platform: string | null;

  product_region: string | null;

  order_id: string | null;

  order_reference: string | null;

  total: number | string;

  payment_status: string;

  service_status: string | null;

  messages: ChatMessage[];
  has_older?: boolean;

  payment_requests: PaymentRequest[];
};

/* =========================================================
   HELPERS
========================================================= */

function money(value: number | string, currency = "USD") {
  return Number(value).toLocaleString("en-US", {
    style: "currency",

    currency: currency.toUpperCase(),
  });
}

function statusLabel(value: string | null | undefined) {
  return (value ?? "new")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

// Full message timestamp, e.g. "Oct 6, 3:42 PM". Same format as before, but one
// cached formatter instead of a new one per message on every poll.
const messageTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",

  day: "numeric",

  hour: "numeric",

  minute: "2-digit",
});

function formatMessageTime(value: string) {
  return messageTimeFormat.format(new Date(value));
}

const NO_MESSAGES: ChatMessage[] = [];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function paymentRequestIdFromMessage(message: ChatMessage) {
  const value = message.metadata?.payment_request_id;

  return typeof value === "string" ? value : null;
}

// Order work status is authoritative once a paid order exists; "new" orders read as paid.
function customerStatus(chat: ChatData) {
  return chat.order_id && chat.service_status && chat.service_status !== "new"
    ? chat.service_status
    : chat.workflow_status;
}

type JsonBody = Partial<ChatData> & { error?: string; url?: string };

// Gateway/HTML error pages must not surface as raw JSON parser errors.
async function readJson(response: Response): Promise<JsonBody> {
  try {
    return (await response.json()) as JsonBody;
  } catch {
    throw new Error(
      "BirdShop is temporarily unavailable. Please retry in a moment.",
    );
  }
}

function conversationTitle(chat: ChatData) {
  switch (chat.conversation_type) {
    case "product":
      return chat.product_name ?? chat.subject ?? "Product Support";

    case "general":
      return chat.subject ?? "General Support";

    default:
      return chat.service_name ?? chat.subject ?? "Custom Service Request";
  }
}

function conversationSubtitle(chat: ChatData) {
  switch (chat.conversation_type) {
    case "product": {
      const details = [chat.product_platform, chat.product_region].filter(
        Boolean,
      );

      return details.join(" · ") || "Product Help";
    }

    case "general":
      return "BirdShop Support";

    default:
      return chat.package_name ?? "Custom Quote";
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ServiceChatClient() {
  const token = useSearchParams().get("token") ?? "";

  // Keyed by token so history cursors, refs and state never leak between chats.
  return <ServiceChatView key={token} token={token} />;
}

function ServiceChatView({ token }: { token: string }) {
  const router = useRouter();

  const searchParams = useSearchParams();

  const paymentResult = searchParams.get("payment");

  const [chat, setChat] = useState<ChatData | null>(null);

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(Boolean(token));

  const [submitting, setSubmitting] = useState(false);

  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  const [error, setError] = useState("");

  const [confirmSlow, setConfirmSlow] = useState(false);

  /* Presentation-only state (never read by fetch, poll or payment logic). */
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [copied, setCopied] = useState(false);

  const [atBottom, setAtBottom] = useState(true);

  const [seenLatestId, setSeenLatestId] = useState("");

  const copyTimer = useRef<number | undefined>(undefined);

  const now = useNow();

  const chatMessages = chat?.messages ?? NO_MESSAGES;

  const grouped = useMemo(() => groupMessages(chatMessages), [chatMessages]);

  /* =======================================================
     REFS
  ======================================================= */

  const [historyBefore, setHistoryBefore] = useState<string | null>(null);
  const sendIdentity = useRef<{ body: string; id: string } | null>(null);
  const loadingChat = useRef(false);
  const refreshAfter = useRef(0);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const chatRequest = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const lastMessageIdRef = useRef<string | null>(null);

  const shouldFollowRef = useRef(true);

  const initializedScrollRef = useRef(false);

  // Set after a 404 so polling stops for removed or invalid chats.
  const unavailableRef = useRef(false);

  /* =======================================================
     SOUND
  ======================================================= */

  useEffect(() => {
    const unlock = () => {
      void unlockChatSound();
    };

    window.addEventListener("pointerdown", unlock, {
      once: true,
    });

    window.addEventListener("keydown", unlock, {
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);

      window.removeEventListener("keydown", unlock);
    };
  }, []);

  /* =======================================================
     LOAD
  ======================================================= */

  const loadChat = useCallback(
    async (quiet = false) => {
      if (
        !token ||
        unavailableRef.current ||
        loadingChat.current ||
        Date.now() < refreshAfter.current
      )
        return;
      loadingChat.current = true;
      const controller = new AbortController();
      chatRequest.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 15000);

      if (!quiet) {
        setLoading(true);
      }

      try {
        const response = await fetch(
          `/api/service-chat/${encodeURIComponent(token)}${historyBefore ? `?before=${historyBefore}` : ""}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          if (response.status === 404) {
            unavailableRef.current = true;
            setChat(null);
            // Stop the site-wide notifier from polling a removed chat.
            if (readServiceChatToken() === token) clearServiceChatToken();
          }
          if (response.status === 429) {
            const seconds = Number(response.headers.get("Retry-After")) || 60;
            refreshAfter.current = Date.now() + Math.max(1, seconds) * 1000;
          }
          throw new Error(result.error ?? "Unable to load conversation.");
        }

        if (controller.signal.aborted) return;
        const next = result as ChatData;

        const latest =
          next.messages.length > 0
            ? next.messages[next.messages.length - 1]
            : null;

        // Paging through history must not chime or move the "latest" marker.
        if (!historyBefore) {
          if (
            latest &&
            lastMessageIdRef.current &&
            latest.id !== lastMessageIdRef.current &&
            (latest.sender_type === "admin" || latest.sender_type === "system")
          ) {
            playChatChime();
          }

          if (latest) {
            lastMessageIdRef.current = latest.id;
          }
        }

        setChat(next);
        saveServiceChatToken(token);
        setError("");
      } catch (problem) {
        if (chatRequest.current !== controller) return;
        setError(
          controller.signal.aborted
            ? "Connection interrupted. We’ll try again shortly."
            : problem instanceof Error
              ? problem.message
              : "Unable to load conversation.",
        );
      } finally {
        window.clearTimeout(timeout);
        // An old request must not clear a newer request's loading state.
        if (chatRequest.current === controller) {
          chatRequest.current = null;
          loadingChat.current = false;
          if (!quiet) setLoading(false);
        }
      }
    },
    [token, historyBefore],
  );

  /* =======================================================
     POLLING
  ======================================================= */

  useEffect(() => {
    let disposed = false;
    let pending: number | undefined;
    let lastRefresh = 0;

    function refresh() {
      if (
        disposed ||
        !token ||
        historyBefore ||
        document.visibilityState !== "visible"
      )
        return;
      window.clearTimeout(pending);
      const delay = Math.max(
        refreshAfter.current - Date.now(),
        1000 - (Date.now() - lastRefresh),
      );
      if (loadingChat.current || delay > 0) {
        pending = window.setTimeout(refresh, Math.max(250, delay));
        return;
      }
      lastRefresh = Date.now();
      void loadChat(true);
    }

    window.addEventListener(SERVICE_CHAT_LIVE_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    const initialLoad = window.setTimeout(() => {
      if (!token) {
        setChat(null);
        setLoading(false);
      } else {
        void loadChat();
      }
    }, 0);
    // Live events handle normal delivery; polling covers missed events.
    const interval = token ? window.setInterval(refresh, 10000) : undefined;
    return () => {
      disposed = true;
      window.removeEventListener(SERVICE_CHAT_LIVE_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearTimeout(initialLoad);
      window.clearTimeout(pending);
      window.clearInterval(interval);
      chatRequest.current?.abort();
      chatRequest.current = null;
      loadingChat.current = false;
    };
  }, [token, loadChat, historyBefore]);

  /* =======================================================
     SCROLL TRACKING
  ======================================================= */

  const latestMessageId = chat?.messages[chat.messages.length - 1]?.id ?? "";

  function handleMessagesScroll() {
    const element = messagesRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    const follow = distanceFromBottom <= 100;

    shouldFollowRef.current = follow;

    // Drives the "New messages" button from scroll events, not from an effect.
    setAtBottom(follow);

    if (follow) setSeenLatestId(latestMessageId);
  }

  function jumpToLatest() {
    const element = messagesRef.current;

    if (!element) {
      return;
    }

    shouldFollowRef.current = true;

    element.scrollTo({
      top: element.scrollHeight,

      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  /* =======================================================
     AUTO SCROLL
  ======================================================= */

  useLayoutEffect(() => {
    const element = messagesRef.current;

    if (!element || !shouldFollowRef.current) {
      return;
    }

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (!messagesRef.current) {
          return;
        }

        const current = messagesRef.current;

        if (initializedScrollRef.current) {
          current.scrollTo({
            top: current.scrollHeight,

            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        } else {
          current.scrollTop = current.scrollHeight;

          initializedScrollRef.current = true;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [latestMessageId]);

  /* =======================================================
     RECOVER / OPEN CHAT
  ======================================================= */

  /* =======================================================
     SEND
  ======================================================= */

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = message.trim();

    if (submitting || !token || !trimmed) {
      return;
    }

    shouldFollowRef.current = true;

    setSubmitting(true);
    if (sendIdentity.current?.body !== trimmed)
      sendIdentity.current = { body: trimmed, id: crypto.randomUUID() };
    setError("");

    try {
      const response = await fetch(
        `/api/service-chat/${encodeURIComponent(token)}`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            message: trimmed,
            requestId: sendIdentity.current?.id,
          }),
        },
      );

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to send message.");
      }

      const next = result as ChatData;

      const latest =
        next.messages.length > 0
          ? next.messages[next.messages.length - 1]
          : null;

      if (latest) {
        lastMessageIdRef.current = latest.id;
      }

      // Prevent an older GET response from replacing the just-sent message.
      chatRequest.current?.abort();
      chatRequest.current = null;
      loadingChat.current = false;
      setLoading(false);
      setChat(next);

      setMessage("");
      sendIdentity.current = null;
      setHistoryBefore(null);
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to send message.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =======================================================
     ENTER / SHIFT + ENTER
  ======================================================= */

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (submitting || !message.trim()) {
        return;
      }

      event.currentTarget.form?.requestSubmit();
    }
  }

  /* =======================================================
     CHECKOUT
  ======================================================= */

  async function handleCheckout(paymentRequestId: string) {
    if (!token || checkoutId || chat?.conversation_type !== "service") {
      return;
    }

    setCheckoutId(paymentRequestId);

    setError("");

    try {
      const response = await fetch(
        `/api/service-chat/${encodeURIComponent(token)}/checkout`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            paymentRequestId,
          }),
        },
      );

      const result = await readJson(response);

      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Unable to open secure checkout.");
      }

      window.location.assign(result.url);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to open secure checkout.",
      );

      setCheckoutId(null);
    }
  }

  /* =======================================================
     PAYMENT CONFIRMATION

     The Stripe redirect is never proof of payment. Poll gently
     until the webhook-confirmed state arrives, then stop.
  ======================================================= */

  // A webhook-confirmed payment always creates the order and marks its request paid.
  // Refunds later change payment_status, but never undo this confirmation.
  const paymentConfirmed = Boolean(
    chat?.order_id ||
      chat?.payment_requests.some((request) => request.status === "paid"),
  );

  const awaitingConfirmation =
    paymentResult === "success" &&
    chat?.conversation_type === "service" &&
    !paymentConfirmed;

  useEffect(() => {
    if (!awaitingConfirmation) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started > 120_000) {
        window.clearInterval(timer);
        setConfirmSlow(true);
        return;
      }
      if (document.visibilityState === "visible") void loadChat(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [awaitingConfirmation, loadChat]);

  /* =======================================================
     COPY REFERENCE (presentation only)
  ======================================================= */

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);

      setCopied(true);

      window.clearTimeout(copyTimer.current);

      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the reference text stays selectable.
    }
  }

  /* =======================================================
     ACCESS / RECOVERY
  ======================================================= */

  if (!token) return <CustomerInbox />;

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading && !chat) {
    return (
      <section className={`${ui.tokens} ${styles.page}`}>
        <div className={styles.workspace} role="status" aria-live="polite">
          <span className="visually-hidden">
            Opening your BirdShop conversation…
          </span>

          <div className={styles.skeletonSummary} aria-hidden="true" />

          <div className={styles.skeletonChat} aria-hidden="true">
            <span className={styles.skeletonBar} />
            <span className={styles.skeletonBubble} data-side="them" />
            <span className={styles.skeletonBubble} data-side="me" />
            <span className={styles.skeletonBubble} data-side="them" />
          </div>
        </div>
      </section>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (!chat) {
    return (
      <section className={`${ui.tokens} ${styles.page}`}>
        <div className={styles.accessCard}>
          <span className={styles.eyebrow}>Private chat</span>

          <h1>Conversation unavailable.</h1>

          <p>{error || "The BirdShop conversation could not be opened."}</p>

          <div className={styles.accessActions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => router.replace("/service-chat")}
            >
              Back to Your Conversations
            </button>

            <Link className={styles.secondary} href="/contact">
              Contact BirdShop
            </Link>
          </div>
        </div>
      </section>
    );
  }

  /* =======================================================
     PAYMENT STATE
  ======================================================= */

  const isService = chat.conversation_type === "service";

  // Checkout only starts for open chats; a closed chat must not
  // offer a button the server will refuse.
  const chatOpen = chat.conversation_status === "open";

  const paymentMap = new Map(
    chat.payment_requests.map((request) => [request.id, request]),
  );

  const pendingPayment =
    chat.payment_requests.find((request) => request.status === "pending") ??
    null;

  const latestPayment =
    chat.payment_requests.length > 0
      ? chat.payment_requests[chat.payment_requests.length - 1]
      : null;

  const title = conversationTitle(chat);

  const subtitle = conversationSubtitle(chat);

  // The single checkout rule. The summary's duplicate Pay button uses it as is.
  const canPayRequest = (request: PaymentRequest) =>
    request.status === "pending" &&
    !paymentConfirmed &&
    !awaitingConfirmation &&
    chatOpen;

  /* =======================================================
     PRESENTATION
  ======================================================= */

  const stage = customerStatus(chat);

  // Stripe's return URL keeps ?payment=success. Once the order has moved on
  // (completed, cancelled or refunded) the status chip tells the truth, so the
  // "order is active" return notice is no longer shown.
  const returnNoticeStale =
    paymentConfirmed &&
    (chat.payment_status === "refunded" ||
      stage === "completed" ||
      stage === "cancelled");

  const unpaidPending =
    pendingPayment && !paymentConfirmed ? pendingPayment : null;

  const status = chatStatus(chat, {
    stage,
    pendingAmount: unpaidPending?.amount ?? null,
    awaitingConfirmation,
    historyMode: Boolean(historyBefore),
  });

  const statusPulse = status.tone === "action" || status.tone === "payment";

  const steps = serviceSteps(chat, stage, Boolean(unpaidPending));

  const paymentState = !isService
    ? "support"
    : chat.payment_status === "refunded"
      ? "refunded"
      : chat.payment_status === "partially_refunded"
        ? "partial"
        : chat.payment_status === "paid"
          ? "paid"
          : pendingPayment
            ? "pending"
            : latestPayment
              ? "latest"
              : "none";

  const showJump =
    !historyBefore &&
    !atBottom &&
    Boolean(latestMessageId) &&
    latestMessageId !== seenLatestId;

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <section className={`${ui.tokens} ${styles.page}`}>
      <div className={styles.topBar}>
        <Link className={styles.inboxBack} href="/service-chat">
          <ArrowIcon className={styles.backIcon} />
          Your Conversations
        </Link>
      </div>

      {searchParams.get("welcome") === "1" && !welcomeDismissed && (
        <div className={styles.chatNotice} role="status">
          <div>
            <strong>You’re in. Let’s talk.</strong>
            <p>Your private chat is ready. Save this link to return anytime.</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss welcome message"
            onClick={() => setWelcomeDismissed(true)}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <DeviceChatAccess
        key={token}
        conversationId={chat.conversation_id}
        token={token}
      />

      <div className={styles.workspace}>
        {/* ===============================================
            CONVERSATION SUMMARY (forest in both themes)
        =============================================== */}

        <aside className={styles.summary} aria-label="Conversation details">
          <div className={styles.summaryHead}>
            <div className={styles.refRow}>
              <span className={styles.eyebrow}>{chat.reference}</span>

              <button
                type="button"
                className={styles.copyRef}
                aria-label={`Copy reference ${chat.reference}`}
                onClick={() => void copyReference(chat.reference)}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied" : "Copy"}
              </button>

              <span className="visually-hidden" aria-live="polite">
                {copied ? "Reference copied" : ""}
              </span>
            </div>

            <h1>{title}</h1>

            <p className={styles.packageName}>{subtitle}</p>

            <StatusChip
              className={styles.summaryStatus}
              tone={status.tone}
              label={status.label}
              title={status.description}
              size="lg"
              surface="forest"
              pulse={statusPulse}
            />

            <button
              type="button"
              className={styles.summaryToggle}
              aria-expanded={summaryOpen}
              aria-controls="chat-summary-more"
              onClick={() => setSummaryOpen((open) => !open)}
            >
              {summaryOpen ? "Hide Details" : "Details"}
              <ChevronIcon data-open={summaryOpen} />
            </button>
          </div>

          <div
            id="chat-summary-more"
            className={styles.summaryMore}
            data-open={summaryOpen}
          >
            {steps && (
              <ol className={styles.steps} aria-label="Service progress">
                {steps.map((step) => (
                  <li
                    key={step.label}
                    data-state={step.state}
                    aria-current={step.state === "current" ? "step" : undefined}
                  >
                    <span className={styles.stepDot} aria-hidden="true">
                      {step.state === "done" && <CheckIcon />}
                    </span>
                    <span className={styles.stepLabel}>
                      {step.label}
                      {step.state === "done" && (
                        <span className="visually-hidden"> (completed)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <dl className={styles.summaryFacts}>
              <div>
                <dt>Type</dt>
                <dd>{typeLabel(chat.conversation_type)}</dd>
              </div>

              {isService && (
                <div>
                  <dt>Order</dt>
                  <dd>
                    {chat.order_reference ??
                      (chat.order_id ? "Created" : "Not yet")}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* =============================================
              SERVICE PAYMENT SUMMARY (refund-aware)
          ============================================= */}

          <div
            className={styles.futurePayment}
            data-pending={paymentState === "pending"}
            data-open={summaryOpen}
          >
            <span className={styles.factLabel}>
              {isService ? "Payment" : "Support"}
            </span>

            {paymentState === "refunded" ? (
              <p>This payment was refunded.</p>
            ) : paymentState === "partial" ? (
              <p className={styles.paidLine}>
                <CheckIcon />
                Payment received · partially refunded.
              </p>
            ) : paymentState === "paid" ? (
              <p className={styles.paidLine}>
                <CheckIcon />
                Payment received for this service.
              </p>
            ) : paymentState === "pending" && pendingPayment ? (
              <>
                <p>A payment request is ready.</p>

                <strong className={styles.summaryAmount}>
                  {money(pendingPayment.amount, pendingPayment.currency)}
                </strong>

                {canPayRequest(pendingPayment) ? (
                  <button
                    type="button"
                    className={styles.summaryPay}
                    disabled={checkoutId !== null}
                    onClick={() => void handleCheckout(pendingPayment.id)}
                  >
                    <LockIcon />
                    {checkoutId === pendingPayment.id
                      ? "Opening Checkout…"
                      : "Pay Securely"}
                  </button>
                ) : awaitingConfirmation ? (
                  <p className={styles.summaryNote}>
                    <Spinner />
                    Confirming your payment…
                  </p>
                ) : !chatOpen ? (
                  <p className={styles.summaryNote}>
                    This conversation is closed. Contact BirdShop to complete
                    this payment.
                  </p>
                ) : null}
              </>
            ) : paymentState === "latest" && latestPayment ? (
              <p>Latest request: {statusLabel(latestPayment.status)}</p>
            ) : paymentState === "none" ? (
              <p>
                When your quote is ready, a secure payment request will appear
                in this chat.
              </p>
            ) : (
              <p>No payment is needed for this conversation.</p>
            )}
          </div>
        </aside>

        {/* ===============================================
            CHAT
        =============================================== */}

        <section
          className={styles.chat}
          aria-label="Conversation with BirdShop"
        >
          <header className={styles.chatHeader}>
            <span className={styles.avatar} aria-hidden="true">
              B
            </span>

            <div className={styles.chatHeading}>
              <strong>BirdShop Support</strong>
              <span>{typeLabel(chat.conversation_type)} · Private chat</span>
            </div>

            <StatusChip
              className={styles.headerStatus}
              tone={status.tone}
              label={status.label}
              title={status.description}
            />
          </header>

          {/* =============================================
              PAYMENT RETURN MESSAGES
          ============================================= */}

          {isService && paymentResult === "success" && !returnNoticeStale && (
            <div
              className={paymentStyles.notice}
              data-tone="success"
              role="status"
            >
              {paymentConfirmed ? <CheckIcon /> : !confirmSlow && <Spinner />}
              <span>
                {paymentConfirmed
                  ? "Payment confirmed. Your service order is active."
                  : confirmSlow
                    ? "Confirmation is taking longer than usual. This page updates automatically, and you will receive a confirmation email once payment is verified."
                    : "Payment received. Confirming your payment…"}
              </span>
            </div>
          )}

          {isService && paymentResult === "cancelled" && (
            <div className={paymentStyles.notice} data-tone="neutral">
              <span>
                Checkout was cancelled. Your conversation remains available.
              </span>
            </div>
          )}

          {historyBefore && (
            <div className={styles.historyBanner} role="status">
              <span>Viewing earlier messages. Live updates paused.</span>
              <button
                type="button"
                className={styles.textButton}
                disabled={loading}
                onClick={() => setHistoryBefore(null)}
              >
                Back to Latest
              </button>
            </div>
          )}

          {/* =============================================
              MESSAGES
          ============================================= */}

          <div className={styles.messagesWrap}>
            <div
              ref={messagesRef}
              onScroll={handleMessagesScroll}
              className={styles.messages}
              role="log"
              aria-live={historyBefore ? "off" : "polite"}
              aria-relevant="additions"
              aria-label="Messages"
              tabIndex={0}
            >
              {chat.has_older && (
                <div className={styles.historyNav}>
                  <button
                    type="button"
                    className={styles.historyButton}
                    disabled={loading}
                    onClick={() =>
                      setHistoryBefore(chat.messages[0]?.id ?? null)
                    }
                  >
                    Load Earlier Messages
                  </button>
                </div>
              )}

              {chat.messages.length === 0 ? (
                <div className={styles.empty}>
                  <span className={styles.emptyAvatar} aria-hidden="true">
                    B
                  </span>
                  <strong>Say hello.</strong>
                  <p>
                    Tell us what you need. Replies arrive right here, with a
                    soft chime while this page is open.
                  </p>
                </div>
              ) : (
                grouped.map(({ item, first, last, newDay }) => {
                  const dayLabel = newDay ? formatDay(item.created_at, now) : "";

                  const divider = dayLabel ? (
                    <div className={styles.dayDivider}>
                      <span>{dayLabel}</span>
                    </div>
                  ) : null;

                  /* =====================================
                       PAYMENT REQUEST MESSAGE

                       Only service conversations can display
                       an actionable payment request.
                    ===================================== */

                  if (isService && item.message_type === "payment_request") {
                    const requestId = paymentRequestIdFromMessage(item);

                    const request = requestId ? paymentMap.get(requestId) : null;

                    if (request) {
                      const canPay = canPayRequest(request);

                      const refunded =
                        request.refund_status === "full" ||
                        request.refund_status === "partial" ||
                        Number(request.refunded_amount ?? 0) > 0;

                      return (
                        <Fragment key={item.id}>
                          {divider}

                          <article
                            className={paymentStyles.request}
                            data-status={request.status}
                            data-refunded={refunded || undefined}
                            aria-labelledby={`pr-${request.id}`}
                          >
                            <header className={paymentStyles.requestTop}>
                              <span className={paymentStyles.requestEyebrow}>
                                <LockIcon />
                                Payment request
                              </span>

                              <span className={paymentStyles.requestStatus}>
                                {requestChipLabel(request, awaitingConfirmation)}
                              </span>
                            </header>

                            <strong
                              id={`pr-${request.id}`}
                              className={paymentStyles.requestTitle}
                            >
                              {request.title}
                            </strong>

                            {request.description && (
                              <p className={paymentStyles.requestDescription}>
                                {request.description}
                              </p>
                            )}

                            <div className={paymentStyles.paymentLine}>
                              <div className={paymentStyles.amountBlock}>
                                <span className={paymentStyles.amountLabel}>
                                  Total
                                </span>

                                <strong className={paymentStyles.requestAmount}>
                                  {money(request.amount, request.currency)}
                                </strong>
                              </div>

                              {canPay ? (
                                <button
                                  type="button"
                                  className={paymentStyles.button}
                                  disabled={checkoutId !== null}
                                  onClick={() => void handleCheckout(request.id)}
                                >
                                  {checkoutId === request.id ? (
                                    <Spinner />
                                  ) : (
                                    <LockIcon />
                                  )}
                                  {checkoutId === request.id
                                    ? "Opening Checkout…"
                                    : "Pay Securely"}
                                </button>
                              ) : request.status === "paid" ||
                                chat.payment_status === "paid" ? (
                                <strong className={paymentStyles.paidLabel}>
                                  {request.status === "paid" && <CheckIcon />}
                                  {request.status === "paid" && request.paid_at
                                    ? `Paid · ${formatShortDate(request.paid_at, now)}`
                                    : paymentLabel(request)}
                                </strong>
                              ) : null}
                            </div>

                            <footer className={paymentStyles.requestFooter}>
                              {Number(request.refunded_amount ?? 0) > 0 && (
                                <p>
                                  Refunded{" "}
                                  {money(
                                    request.refunded_amount ?? 0,
                                    request.currency,
                                  )}
                                </p>
                              )}
                              <span>
                                {canPay
                                  ? "Secure checkout powered by Stripe."
                                  : awaitingConfirmation
                                    ? "Confirming your payment…"
                                  : request.status === "pending" && !chatOpen
                                    ? "This conversation is closed. Contact BirdShop to complete this payment."
                                  : request.status === "cancelled"
                                    ? "This payment request was cancelled."
                                    : request.status === "paid"
                                      ? "Payment confirmed."
                                      : "This payment request is no longer active."}
                              </span>

                              <small className={paymentStyles.safeNote}>
                                BirdShop never asks you to enter card
                                information directly into chat.
                              </small>
                            </footer>
                          </article>
                        </Fragment>
                      );
                    }
                  }

                  /* =====================================
                       SYSTEM MESSAGE
                    ===================================== */

                  if (item.sender_type === "system") {
                    return (
                      <Fragment key={item.id}>
                        {divider}

                        <article className={styles.systemMessage}>
                          <p>{item.body}</p>
                          <time
                            dateTime={item.created_at}
                            title={formatMessageTime(item.created_at)}
                          >
                            {formatClock(item.created_at)}
                          </time>
                        </article>
                      </Fragment>
                    );
                  }

                  /* =====================================
                       NORMAL MESSAGE
                    ===================================== */

                  const fromBirdShop = item.sender_type === "admin";

                  const senderName = fromBirdShop
                    ? item.sender_label || "BirdShop"
                    : "You";

                  return (
                    <Fragment key={item.id}>
                      {divider}

                      <article
                        className={
                          fromBirdShop
                            ? styles.adminMessage
                            : styles.customerMessage
                        }
                        data-first={first}
                        data-last={last}
                      >
                        {fromBirdShop && last && (
                          <span className={styles.bubbleAvatar} aria-hidden="true">
                            B
                          </span>
                        )}

                        {first ? (
                          <header className={styles.bubbleMeta}>
                            <strong>{senderName}</strong>
                            <time
                              dateTime={item.created_at}
                              title={formatMessageTime(item.created_at)}
                            >
                              {formatClock(item.created_at)}
                            </time>
                          </header>
                        ) : (
                          // Grouped follow-ups keep sender and time for screen readers.
                          <span className="visually-hidden">{senderName}: </span>
                        )}

                        <p>{item.body}</p>

                        {!first && (
                          <time
                            className="visually-hidden"
                            dateTime={item.created_at}
                          >
                            {formatMessageTime(item.created_at)}
                          </time>
                        )}
                      </article>
                    </Fragment>
                  );
                })
              )}
            </div>

            {showJump && (
              <button
                type="button"
                className={styles.jumpLatest}
                onClick={jumpToLatest}
              >
                New Messages
                <ChevronIcon />
              </button>
            )}
          </div>

          {/* =============================================
              COMPOSER
          ============================================= */}

          {chatOpen ? (
            <form onSubmit={handleSend} className={styles.composer}>
              <div className={styles.composerField}>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  placeholder="Message BirdShop…"
                  aria-label="Message BirdShop"
                  aria-describedby="composer-hint"
                  maxLength={4000}
                  rows={1}
                />

                <button
                  type="submit"
                  className={styles.send}
                  disabled={submitting || !message.trim()}
                >
                  {submitting ? <Spinner /> : <SendIcon />}
                  <span className={styles.sendLabel}>
                    {submitting ? "Sending…" : "Send"}
                  </span>
                </button>
              </div>

              <div id="composer-hint" className={styles.composerHint}>
                <span className={styles.errorText} aria-live="polite">
                  {error}
                </span>

                {!error && (
                  <span className={styles.keyHint}>
                    Enter to send · Shift + Enter for a new line
                  </span>
                )}

                {message.length > 3600 && (
                  <span className={styles.counter}>
                    {message.length.toLocaleString("en-US")} / 4,000
                  </span>
                )}
              </div>
            </form>
          ) : (
            <div className={styles.closed}>
              <CheckIcon />

              <div>
                <strong>This conversation is closed.</strong>

                <p>
                  Need anything else?{" "}
                  <Link href="/contact">Start a new conversation</Link>.
                </p>

                {error && (
                  <span className={styles.errorText} role="alert">
                    {error}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
