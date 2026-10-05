"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { playChatChime, unlockChatSound } from "@/lib/chat-sound";

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

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",

    day: "numeric",

    hour: "numeric",

    minute: "2-digit",
  }).format(new Date(value));
}

function paymentRequestIdFromMessage(message: ChatMessage) {
  const value = message.metadata?.payment_request_id;

  return typeof value === "string" ? value : null;
}

function conversationTypeLabel(type: ConversationType) {
  switch (type) {
    case "product":
      return "PRODUCT SUPPORT";

    case "general":
      return "GENERAL SUPPORT";

    default:
      return "SERVICE";
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
  const router = useRouter();

  const searchParams = useSearchParams();

  const token = searchParams.get("token") ?? "";

  const paymentResult = searchParams.get("payment");

  const [reference, setReference] = useState("");

  const [contact, setContact] = useState("");

  const [chat, setChat] = useState<ChatData | null>(null);

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(Boolean(token));

  const [submitting, setSubmitting] = useState(false);

  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [recoveryNotice, setRecoveryNotice] = useState("");

  /* =======================================================
     REFS
  ======================================================= */

  const [historyBefore, setHistoryBefore] = useState<string | null>(null);
  const sendIdentity = useRef<{ body: string; id: string } | null>(null);
  const loadingChat = useRef(false);
  const chatRequest = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const lastMessageIdRef = useRef<string | null>(null);

  const shouldFollowRef = useRef(true);

  const initializedScrollRef = useRef(false);

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
     RESET CHAT
  ======================================================= */

  useEffect(() => {
    shouldFollowRef.current = true;

    initializedScrollRef.current = false;

    lastMessageIdRef.current = null;
  }, [token]);

  /* =======================================================
     LOAD
  ======================================================= */

  const loadChat = useCallback(
    async (quiet = false) => {
      if (!token || loadingChat.current) return;
      loadingChat.current = true;
      const controller = new AbortController();
      chatRequest.current = controller;

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

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load conversation.");
        }

        if (controller.signal.aborted) return;
        const next = result as ChatData;

        const latest =
          next.messages.length > 0
            ? next.messages[next.messages.length - 1]
            : null;

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

        setChat(next);

        setError("");
      } catch (problem) {
        if (controller.signal.aborted) return;
        setError(
          problem instanceof Error
            ? problem.message
            : "Unable to load conversation.",
        );
      } finally {
        loadingChat.current = false;
        if (!quiet) {
          setLoading(false);
        }
      }
    },
    [token, historyBefore],
  );

  /* =======================================================
     POLLING
  ======================================================= */

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      if (!token) {
        setChat(null);
        setLoading(false);
      } else {
        void loadChat();
      }
    }, 0);
    const interval = token
      ? window.setInterval(() => {
          if (!historyBefore && document.visibilityState === "visible")
            void loadChat(true);
        }, 2000)
      : null;
    return () => {
      chatRequest.current?.abort();
      loadingChat.current = false;
      window.clearTimeout(initialLoad);
      if (interval !== null) window.clearInterval(interval);
    };
  }, [token, loadChat, historyBefore]);

  /* =======================================================
     SCROLL TRACKING
  ======================================================= */

  function handleMessagesScroll() {
    const element = messagesRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    shouldFollowRef.current = distanceFromBottom <= 100;
  }

  /* =======================================================
     AUTO SCROLL
  ======================================================= */

  const latestMessageId = chat?.messages[chat.messages.length - 1]?.id ?? "";

  useLayoutEffect(() => {
    const element = messagesRef.current;

    if (!element || !shouldFollowRef.current) {
      return;
    }

    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        if (!messagesRef.current) {
          return;
        }

        const current = messagesRef.current;

        if (initializedScrollRef.current) {
          current.scrollTo({
            top: current.scrollHeight,

            behavior: "smooth",
          });
        } else {
          current.scrollTop = current.scrollHeight;

          initializedScrollRef.current = true;
        }
      });

      return () => {
        window.cancelAnimationFrame(secondFrame);
      };
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
    };
  }, [latestMessageId]);

  /* =======================================================
     RECOVER / OPEN CHAT
  ======================================================= */

  async function handleOpenChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/service-chat/open", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          reference,
          contact,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to open conversation.");
      }

      setRecoveryNotice(result.message);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to open conversation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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

      const result = await response.json();

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

      const result = await response.json();

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
     ACCESS / RECOVERY
  ======================================================= */

  if (!token) {
    return (
      <section className={styles.page}>
        <div className={styles.accessCard}>
          <span className={styles.eyebrow}>BIRDSHOP / PRIVATE CHAT</span>

          <h1>Return to your conversation.</h1>

          <p>
            Enter your BirdShop reference and the email address used when the
            conversation was created.
          </p>

          <form onSubmit={handleOpenChat} className={styles.accessForm}>
            <label>
              <span>BIRDSHOP REFERENCE</span>

              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="BS-100003"
                required
              />
            </label>

            <label>
              <span>EMAIL / CONTACT</span>

              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="The email address used on your request"
                required
              />
            </label>

            {recoveryNotice && <p role="status">{recoveryNotice}</p>}
            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" disabled={submitting}>
              {submitting ? "Opening..." : "Open Private Chat"}
            </button>
          </form>

          <small>
            This recovery page works for service requests, product support, and
            general BirdShop support.
          </small>
        </div>
      </section>
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading && !chat) {
    return (
      <section className={styles.page}>
        <div className={styles.loading}>
          Opening your BirdShop conversation...
        </div>
      </section>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (!chat) {
    return (
      <section className={styles.page}>
        <div className={styles.accessCard}>
          <span className={styles.eyebrow}>PRIVATE CHAT</span>

          <h1>Conversation unavailable.</h1>

          <p>{error || "The BirdShop conversation could not be opened."}</p>

          <button type="button" onClick={() => router.replace("/service-chat")}>
            Return to Private Chat
          </button>
        </div>
      </section>
    );
  }

  /* =======================================================
     PAYMENT STATE
  ======================================================= */

  const isService = chat.conversation_type === "service";

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

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <section className={styles.page}>
      <div className={styles.workspace}>
        {/* ===============================================
            CONVERSATION SUMMARY
        =============================================== */}

        <aside className={styles.summary}>
          <span className={styles.eyebrow}>{chat.reference}</span>

          <h1>{title}</h1>

          <p className={styles.packageName}>{subtitle}</p>

          <div className={styles.summaryFacts}>
            <div>
              <span>TYPE</span>

              <strong>{conversationTypeLabel(chat.conversation_type)}</strong>
            </div>

            <div>
              <span>STATUS</span>

              <strong>{statusLabel(chat.workflow_status)}</strong>
            </div>

            {isService && (
              <div>
                <span>ORDER</span>

                <strong>{chat.order_id ? "Created" : "Not Created"}</strong>
              </div>
            )}
          </div>

          {/* =============================================
              SERVICE PAYMENT SUMMARY
          ============================================= */}

          {isService ? (
            <div className={styles.futurePayment}>
              <span>PAYMENT</span>

              {chat.payment_status === "paid" ? (
                <p>✓ Payment received for this service.</p>
              ) : pendingPayment ? (
                <>
                  <p>A payment request is ready.</p>

                  <strong>
                    {money(pendingPayment.amount, pendingPayment.currency)}
                  </strong>
                </>
              ) : latestPayment ? (
                <p>Latest request: {statusLabel(latestPayment.status)}</p>
              ) : (
                <p>No payment request has been sent yet.</p>
              )}
            </div>
          ) : (
            <div className={styles.futurePayment}>
              <span>SUPPORT</span>

              <p>
                This conversation does not require a service payment request.
              </p>
            </div>
          )}
        </aside>

        {/* ===============================================
            CHAT
        =============================================== */}

        <section className={styles.chat}>
          <header className={styles.chatHeader}>
            <div>
              <span>
                {conversationTypeLabel(chat.conversation_type)}
                {" · "}
                PRIVATE CHAT
              </span>

              <strong>BirdShop Support</strong>
            </div>

            <span className={styles.online}>WEBSITE CHAT</span>
          </header>

          {/* =============================================
              PAYMENT RETURN MESSAGES
          ============================================= */}

          {isService && paymentResult === "success" && (
            <div className={paymentStyles.notice} data-tone="success">
              You returned from checkout. BirdShop is checking the payment
              status.
            </div>
          )}

          {isService && paymentResult === "cancelled" && (
            <div className={paymentStyles.notice} data-tone="neutral">
              Checkout was cancelled. Your conversation remains available.
            </div>
          )}

          {/* =============================================
              MESSAGES
          ============================================= */}

          <div
            ref={messagesRef}
            onScroll={handleMessagesScroll}
            className={styles.messages}
          >
            <nav
              aria-label="Conversation history"
              style={{ display: "flex", gap: 16, padding: 12 }}
            >
              {historyBefore && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setHistoryBefore(null)}
                >
                  Latest messages
                </button>
              )}
              {chat.has_older && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setHistoryBefore(chat.messages[0]?.id ?? null)}
                >
                  Earlier messages
                </button>
              )}
            </nav>
            {chat.messages.length === 0 ? (
              <div className={styles.empty}>
                Send the first message to BirdShop.
              </div>
            ) : (
              chat.messages.map((item) => {
                /* =====================================
                     PAYMENT REQUEST MESSAGE

                     Only service conversations can display
                     an actionable payment request.
                  ===================================== */

                if (isService && item.message_type === "payment_request") {
                  const requestId = paymentRequestIdFromMessage(item);

                  const request = requestId ? paymentMap.get(requestId) : null;

                  if (request) {
                    const canPay =
                      request.status === "pending" &&
                      chat.payment_status !== "paid";

                    return (
                      <article
                        key={item.id}
                        className={paymentStyles.request}
                        data-status={request.status}
                      >
                        <div className={paymentStyles.requestTop}>
                          <div>
                            <span className={paymentStyles.requestEyebrow}>
                              BIRDSHOP PAYMENT REQUEST
                            </span>

                            <strong className={paymentStyles.requestTitle}>
                              {request.title}
                            </strong>
                          </div>

                          <span className={paymentStyles.requestStatus}>
                            {statusLabel(request.status)}
                          </span>
                        </div>

                        {request.description && (
                          <p className={paymentStyles.requestDescription}>
                            {request.description}
                          </p>
                        )}

                        <div className={paymentStyles.paymentLine}>
                          <strong className={paymentStyles.requestAmount}>
                            {money(request.amount, request.currency)}
                          </strong>

                          {canPay ? (
                            <button
                              type="button"
                              className={paymentStyles.button}
                              disabled={checkoutId !== null}
                              onClick={() => void handleCheckout(request.id)}
                            >
                              {checkoutId === request.id
                                ? "Opening Checkout..."
                                : "Pay Securely"}
                            </button>
                          ) : request.status === "paid" ||
                            chat.payment_status === "paid" ? (
                            <strong className={paymentStyles.paidLabel}>
                              ✓ Payment Received
                            </strong>
                          ) : null}
                        </div>

                        <div className={paymentStyles.requestFooter}>
                          <span>
                            {canPay
                              ? "Secure checkout powered by Stripe."
                              : request.status === "cancelled"
                                ? "This payment request was cancelled."
                                : request.status === "paid"
                                  ? "Payment confirmed."
                                  : "This payment request is no longer active."}
                          </span>
                        </div>

                        <small className={paymentStyles.safeNote}>
                          BirdShop never asks you to enter card information
                          directly into chat.
                        </small>
                      </article>
                    );
                  }
                }

                /* =====================================
                     NORMAL MESSAGE
                  ===================================== */

                return (
                  <article
                    key={item.id}
                    className={
                      item.sender_type === "admin"
                        ? styles.adminMessage
                        : item.sender_type === "system"
                          ? styles.systemMessage
                          : styles.customerMessage
                    }
                  >
                    <div>
                      <strong>
                        {item.sender_label ||
                          (item.sender_type === "admin"
                            ? "BirdShop"
                            : "Customer")}
                      </strong>

                      <span>{formatMessageTime(item.created_at)}</span>
                    </div>

                    <p>{item.body}</p>
                  </article>
                );
              })
            )}
          </div>

          {/* =============================================
              COMPOSER
          ============================================= */}

          {chat.conversation_status === "open" ? (
            <form onSubmit={handleSend} className={styles.composer}>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleMessageKeyDown}
                placeholder="Message BirdShop..."
                maxLength={4000}
                rows={2}
              />

              <div>
                {error ? (
                  <span className={styles.errorText}>{error}</span>
                ) : (
                  <span>Enter to send · Shift + Enter for a new line</span>
                )}

                <button type="submit" disabled={submitting || !message.trim()}>
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.closed}>
              This BirdShop conversation has been closed.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
