"use client";
import ChatHistory from "./ChatHistory";

import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

import {
  serviceChatChannelName,
  SERVICE_CHAT_BROADCAST_EVENT,
} from "@/lib/service-chat-session";

import { sendAdminChatMessage, cancelPaymentRequest } from "./actions";
import SubmitButton from "@/components/SubmitButton";

import paymentStyles from "./AdminPaymentCenter.module.css";
import styles from "./chat.module.css";

/* =========================================================
   TYPES
========================================================= */

export type AdminLiveMessage = {
  id: string;

  conversation_id: string;

  sender_type: string;

  sender_label: string | null;

  body: string;

  message_type: string;

  metadata: Record<string, unknown>;

  created_at: string;
};

export type AdminLivePaymentRequest = {
  id: string;

  conversation_id: string;

  order_id: string | null;

  amount: number | string;

  currency: string;

  title: string;

  description: string | null;

  status: "pending" | "paid" | "cancelled" | "expired";

  stripe_checkout_session_id: string | null;

  paid_at: string | null;

  cancelled_at: string | null;

  created_at: string;
};

type OptimisticMessage = AdminLiveMessage & {
  optimistic?: boolean;
};

/* =========================================================
   SETTINGS
========================================================= */

const FALLBACK_SYNC_MS = 15000;

/* =========================================================
   HELPERS
========================================================= */

function money(value: number | string, currency = "USD") {
  return Number(value).toLocaleString("en-US", {
    style: "currency",

    currency: currency.toUpperCase(),
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",

    day: "numeric",

    hour: "numeric",

    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(value: string | null) {
  return (value ?? "new")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function paymentRequestIdFromMessage(message: AdminLiveMessage) {
  const value = message.metadata?.payment_request_id;

  return typeof value === "string" ? value : null;
}

function sortMessages<T extends AdminLiveMessage>(messages: T[]) {
  return [...messages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AdminLiveThread({
  conversationId,
  initialMessages,
  initialPaymentRequests,
}: {
  conversationId: string;

  initialMessages: AdminLiveMessage[];

  initialPaymentRequests: AdminLivePaymentRequest[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [messages, setMessages] =
    useState<OptimisticMessage[]>(initialMessages);

  const [paymentRequests, setPaymentRequests] = useState<
    AdminLivePaymentRequest[]
  >(initialPaymentRequests);

  const [lastServerPayments, setLastServerPayments] = useState(
    initialPaymentRequests,
  );
  // Accept fresh server data after a create/cancel action revalidates the page.
  // Realtime changes still update paymentRequests between server refreshes.
  if (lastServerPayments !== initialPaymentRequests) {
    setLastServerPayments(initialPaymentRequests);
    setPaymentRequests(initialPaymentRequests);
  }

  const [body, setBody] = useState("");

  const sendIdentity = useRef<{ body: string; id: string } | null>(null);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messagesRef = useRef<HTMLDivElement | null>(null);

  const followBottomRef = useRef(true);

  const scrollInitializedRef = useRef(false);

  /*
   * Dedicated channel used only to wake up the customer.
   */

  const customerChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  /* =======================================================
     CUSTOMER BROADCAST CHANNEL
  ======================================================= */

  useEffect(() => {
    let disposed = false;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function connectCustomerChannel() {
      const { data, error: tokenError } = await supabase
        .from("service_conversations")
        .select("public_token")
        .eq("id", conversationId)
        .maybeSingle();

      if (disposed || tokenError || !data?.public_token) {
        return;
      }

      const token = String(data.public_token);

      channel = supabase.channel(serviceChatChannelName(token));

      channel.subscribe((status) => {
        if (disposed) {
          return;
        }

        if (status === "SUBSCRIBED") {
          customerChannelRef.current = channel;
        }
      });
    }

    void connectCustomerChannel();

    return () => {
      disposed = true;

      if (customerChannelRef.current === channel) {
        customerChannelRef.current = null;
      }

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [supabase, conversationId]);

  /* =======================================================
     TELL CUSTOMER IMMEDIATELY
  ======================================================= */

  async function notifyCustomer() {
    const channel = customerChannelRef.current;

    if (!channel) {
      /*
       * Customer still has the 1-second fallback notifier,
       * so a missed Broadcast does not lose the message.
       */

      return;
    }

    try {
      await channel.send({
        type: "broadcast",

        event: SERVICE_CHAT_BROADCAST_EVENT,

        payload: {
          conversation_id: conversationId,

          changed_at: Date.now(),
        },
      });
    } catch {
      /*
       * Message itself is already safely saved.
       * Customer fallback will pick it up.
       */
    }
  }

  /* =======================================================
     SCROLL
  ======================================================= */

  function handleScroll() {
    const element = messagesRef.current;

    if (!element || !scrollInitializedRef.current) {
      return;
    }

    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    followBottomRef.current = distance <= 110;
  }

  const latestMessageId =
    messages.length > 0 ? messages[messages.length - 1].id : "";

  useLayoutEffect(() => {
    const element = messagesRef.current;

    if (!element || !followBottomRef.current) {
      return;
    }

    element.scrollTop = element.scrollHeight;

    const frame = window.requestAnimationFrame(() => {
      const current = messagesRef.current;

      if (!current || !followBottomRef.current) {
        return;
      }

      current.scrollTop = current.scrollHeight;

      scrollInitializedRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [latestMessageId]);

  /* =======================================================
     RECONCILE
  ======================================================= */

  const reconcileMessages = useCallback((incoming: AdminLiveMessage[]) => {
    setMessages((current) => {
      const next = [...incoming] as OptimisticMessage[];

      const optimistic = current.filter((item) => item.optimistic);

      for (const temp of optimistic) {
        const matchingReal = incoming.find(
          (item) =>
            item.sender_type === "admin" &&
            item.body === temp.body &&
            Math.abs(
              new Date(item.created_at).getTime() -
                new Date(temp.created_at).getTime(),
            ) < 30000,
        );

        if (!matchingReal) {
          next.push(temp);
        }
      }

      return sortMessages(next);
    });
  }, []);

  /* =======================================================
     DIRECT DB SYNC
  ======================================================= */

  const syncMessages = useCallback(async () => {
    const { data, error: messageError } = await supabase
      .from("service_messages")
      .select(
        "id, conversation_id, sender_type, sender_label, body, message_type, metadata, created_at",
      )
      .eq("conversation_id", conversationId)
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (messageError || !data) {
      return;
    }

    reconcileMessages(data.reverse() as unknown as AdminLiveMessage[]);
  }, [supabase, conversationId, reconcileMessages]);

  const syncPayments = useCallback(async () => {
    const { data, error: paymentError } = await supabase
      .from("service_payment_requests")
      .select(
        "id, conversation_id, order_id, amount, currency, title, description, status, stripe_checkout_session_id, paid_at, cancelled_at, created_at",
      )
      .eq("conversation_id", conversationId)
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (paymentError || !data) {
      return;
    }

    setPaymentRequests(data.reverse() as unknown as AdminLivePaymentRequest[]);
  }, [supabase, conversationId]);

  /* =======================================================
     ADMIN REALTIME
  ======================================================= */

  useEffect(() => {
    const channel = supabase
      .channel(`birdshop-live-thread-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",

          schema: "public",

          table: "service_messages",

          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as AdminLiveMessage;

          setMessages((current) => {
            if (current.some((item) => item.id === incoming.id)) {
              return current;
            }

            if (incoming.sender_type === "admin") {
              const optimisticIndex = current.findIndex(
                (item) =>
                  item.optimistic &&
                  item.sender_type === "admin" &&
                  item.body === incoming.body,
              );

              if (optimisticIndex >= 0) {
                const next = [...current];

                next[optimisticIndex] = incoming;

                return sortMessages(next);
              }
            }

            return sortMessages([...current, incoming]);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",

          schema: "public",

          table: "service_payment_requests",

          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void syncPayments();
        },
      )
      .subscribe();

    const fallback = window.setInterval(() => {
      void syncMessages();
    }, FALLBACK_SYNC_MS);

    return () => {
      window.clearInterval(fallback);

      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, syncMessages, syncPayments]);

  /* =======================================================
     FOCUS
  ======================================================= */

  function focusComposer() {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus({
        preventScroll: true,
      });
    });
  }

  /* =======================================================
     SEND
  ======================================================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();

    if (!trimmed || sending) {
      focusComposer();

      return;
    }

    followBottomRef.current = true;

    const optimisticId = `optimistic-${window.crypto.randomUUID()}`;

    const optimisticMessage: OptimisticMessage = {
      id: optimisticId,

      conversation_id: conversationId,

      sender_type: "admin",

      sender_label: "BirdShop",

      body: trimmed,

      message_type: "text",

      metadata: {},

      created_at: new Date().toISOString(),

      optimistic: true,
    };

    /*
     * Immediate Admin-side appearance.
     */

    setMessages((current) => sortMessages([...current, optimisticMessage]));

    setBody("");

    setError("");

    focusComposer();

    setSending(true);

    const formData = new FormData();

    formData.set("conversation_id", conversationId);

    formData.set("body", trimmed);
    if (sendIdentity.current?.body !== trimmed)
      sendIdentity.current = { body: trimmed, id: crypto.randomUUID() };
    formData.set("request_id", sendIdentity.current.id);

    try {
      const result = await sendAdminChatMessage(formData);

      if (!result.ok) {
        setMessages((current) =>
          current.filter((item) => item.id !== optimisticId),
        );

        setBody(trimmed);

        setError(result.error);

        focusComposer();

        return;
      }

      /*
       * DATABASE COMMIT FINISHED.
       *
       * Wake customer immediately.
       */

      sendIdentity.current = null;
      void notifyCustomer();

      /*
       * Reconcile temporary bubble with real DB row.
       */

      await syncMessages();
    } catch (problem) {
      setMessages((current) =>
        current.filter((item) => item.id !== optimisticId),
      );

      setBody(trimmed);

      setError(
        problem instanceof Error ? problem.message : "Unable to send message.",
      );
    } finally {
      setSending(false);

      focusComposer();
    }
  }

  /* =======================================================
     ENTER
  ======================================================= */

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (sending || !body.trim()) {
        return;
      }

      event.currentTarget.form?.requestSubmit();
    }
  }

  /* =======================================================
     PAYMENT LOOKUP
  ======================================================= */

  const paymentMap = new Map(
    paymentRequests.map((request) => [request.id, request]),
  );

  /* =======================================================
     RENDER MESSAGE
  ======================================================= */

  function renderMessage(item: OptimisticMessage): ReactNode {
    if (item.message_type === "payment_request") {
      const requestId = paymentRequestIdFromMessage(item);

      const request = requestId ? paymentMap.get(requestId) : null;

      if (request) {
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
              {request.status === "pending" && (
                <form action={cancelPaymentRequest}>
                  <input
                    type="hidden"
                    name="conversation_id"
                    value={conversationId}
                  />
                  <input
                    type="hidden"
                    name="payment_request_id"
                    value={request.id}
                  />
                  <SubmitButton className={paymentStyles.secondaryButton}>
                    Cancel request
                  </SubmitButton>
                </form>
              )}
            </div>

            <div className={paymentStyles.requestFooter}>
              <span>Sent {formatDate(request.created_at)}</span>

              {request.status === "paid" && <strong>PAYMENT RECEIVED</strong>}
            </div>
          </article>
        );
      }
    }

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
        data-optimistic={item.optimistic ? "true" : undefined}
      >
        <div>
          <strong>
            {item.sender_label ||
              (item.sender_type === "admin" ? "BirdShop" : "Customer")}
          </strong>

          <span>
            {item.optimistic ? "Sending..." : formatDate(item.created_at)}
          </span>
        </div>

        <p>{item.body}</p>
      </article>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <>
      <div
        ref={messagesRef}
        className={styles.messages}
        onScroll={handleScroll}
      >
        {messages.length >= 100 && (
          <ChatHistory conversationId={conversationId} before={messages[0]} />
        )}
        {messages.length === 0 ? (
          <div className={styles.emptyChat}>No messages yet.</div>
        ) : (
          messages.map(renderMessage)
        )}
      </div>

      <form onSubmit={handleSubmit} className={styles.composer}>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply to the customer..."
          rows={2}
          maxLength={4000}
          autoComplete="off"
          data-admin-chat-composer="true"
        />

        <div>
          {error ? (
            <span>{error}</span>
          ) : (
            <span>Enter to send · Shift + Enter for a new line</span>
          )}

          <button type="submit" disabled={sending || !body.trim()}>
            {sending ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </form>
    </>
  );
}
