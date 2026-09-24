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

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  playChatChime,
  unlockChatSound,
} from "@/lib/chat-sound";

import {
  saveServiceChatToken,
  SERVICE_CHAT_LIVE_EVENT,
} from "@/lib/service-chat-session";

import paymentStyles from "./ServiceChatPaymentUI.module.css";
import styles from "./service-chat.module.css";

/* =========================================================
   TYPES
========================================================= */

type ChatMessage = {
  id: string;

  sender_type:
    | "customer"
    | "admin"
    | "system";

  sender_label:
    | string
    | null;

  body: string;

  message_type:
    | "text"
    | "payment_request"
    | "system";

  metadata:
    Record<
      string,
      unknown
    >;

  created_at: string;
};

type PaymentRequest = {
  id: string;

  amount:
    | number
    | string;

  currency: string;

  title: string;

  description:
    | string
    | null;

  status:
    | "pending"
    | "paid"
    | "cancelled"
    | "expired";

  created_at: string;

  paid_at:
    | string
    | null;
};

type ChatData = {
  conversation_id: string;

  reference: string;

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

  customer_name: string;

  conversation_status:
    string;

  messages:
    ChatMessage[];

  payment_requests:
    PaymentRequest[];
};

/* =========================================================
   HELPERS
========================================================= */

function money(
  value:
    | number
    | string,
  currency = "USD"
) {
  return Number(
    value
  ).toLocaleString(
    "en-US",
    {
      style: "currency",

      currency:
        currency.toUpperCase(),
    }
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

function formatMessageTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",

      day: "numeric",

      hour: "numeric",

      minute:
        "2-digit",
    }
  ).format(
    new Date(
      value
    )
  );
}

function paymentRequestIdFromMessage(
  message:
    ChatMessage
) {
  const value =
    message.metadata
      ?.payment_request_id;

  return typeof value ===
    "string"
    ? value
    : null;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ServiceChatClient() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const token =
    searchParams.get(
      "token"
    ) ?? "";

  const paymentResult =
    searchParams.get(
      "payment"
    );

  const [
    reference,
    setReference,
  ] = useState("");

  const [
    contact,
    setContact,
  ] = useState("");

  const [
    chat,
    setChat,
  ] =
    useState<ChatData | null>(
      null
    );

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(
    Boolean(token)
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    checkoutId,
    setCheckoutId,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     REFS
  ======================================================= */

  const messagesRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const lastMessageIdRef =
    useRef<
      string | null
    >(null);

  /*
   * Whether the chat should continue following new
   * messages.
   */

  const shouldFollowRef =
    useRef(true);

  /*
   * Prevents first render from using smooth animation.
   */

  const initializedScrollRef =
    useRef(false);

  /* =======================================================
     SOUND
  ======================================================= */

  useEffect(() => {
    const unlock =
      () => {
        void unlockChatSound();
      };

    window.addEventListener(
      "pointerdown",
      unlock,
      {
        once: true,
      }
    );

    window.addEventListener(
      "keydown",
      unlock,
      {
        once: true,
      }
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        unlock
      );

      window.removeEventListener(
        "keydown",
        unlock
      );
    };
  }, []);

  /* =======================================================
     RESET WHEN OPENING A DIFFERENT CHAT
  ======================================================= */

  useEffect(() => {
    shouldFollowRef.current =
      true;

    initializedScrollRef.current =
      false;

    lastMessageIdRef.current =
      null;
  }, [
    token,
  ]);

  /* =======================================================
     REMEMBER PRIVATE SERVICE CHAT

     This lets the global public-site notifier stay attached
     to this customer's private conversation while they
     browse the rest of BirdShop in the same tab.
  ======================================================= */

  useEffect(() => {
    if (!token) {
      return;
    }

    saveServiceChatToken(
      token
    );
  }, [
    token,
  ]);

  /* =======================================================
     LOAD CHAT
  ======================================================= */

  const loadChat =
    useCallback(
      async (
        quiet = false
      ) => {
        if (!token) {
          return;
        }

        if (!quiet) {
          setLoading(
            true
          );
        }

        try {
          const response =
            await fetch(
              `/api/service-chat/${encodeURIComponent(
                token
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const result =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              result.error ??
                "Unable to load chat."
            );
          }

          const next =
            result as ChatData;

          const latest =
            next.messages.length >
            0
              ? next.messages[
                  next.messages.length -
                    1
                ]
              : null;

          /*
           * Sound only for new incoming BirdShop/system
           * messages. Never chime just because the page
           * initially opened.
           */

          if (
            latest &&
            lastMessageIdRef.current &&
            latest.id !==
              lastMessageIdRef.current &&
            (
              latest.sender_type ===
                "admin" ||
              latest.sender_type ===
                "system"
            )
          ) {
            playChatChime();
          }

          if (latest) {
            lastMessageIdRef.current =
              latest.id;
          }

          setChat(
            next
          );

          setError("");
        } catch (
          problem
        ) {
          setError(
            problem instanceof
              Error
              ? problem.message
              : "Unable to load chat."
          );
        } finally {
          if (!quiet) {
            setLoading(
              false
            );
          }
        }
      },
      [
        token,
      ]
    );

  /* =======================================================
     INSTANT ADMIN -> CUSTOMER UPDATE

     PublicServiceChatNotifier receives the Realtime
     Broadcast and fires SERVICE_CHAT_LIVE_EVENT while the
     customer is looking at this page.

     We immediately fetch the protected conversation instead
     of waiting for the 3-second safety poll.
  ======================================================= */

  useEffect(() => {
    if (!token) {
      return;
    }

    function handleLiveUpdate() {
      void loadChat(
        true
      );
    }

    window.addEventListener(
      SERVICE_CHAT_LIVE_EVENT,
      handleLiveUpdate
    );

    return () => {
      window.removeEventListener(
        SERVICE_CHAT_LIVE_EVENT,
        handleLiveUpdate
      );
    };
  }, [
    token,
    loadChat,
  ]);

  /* =======================================================
     POLLING FALLBACK

     This is now only a backup if Realtime is interrupted.
  ======================================================= */

  useEffect(() => {
    if (!token) {
      setChat(null);

      setLoading(false);

      return;
    }

    void loadChat();

    const interval =
      window.setInterval(
        () => {
          void loadChat(
            true
          );
        },
        3000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    token,
    loadChat,
  ]);

  /* =======================================================
     SCROLL TRACKING
  ======================================================= */

  function handleMessagesScroll() {
    const element =
      messagesRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    /*
     * If the customer is within 100px of the bottom,
     * keep following.
     *
     * If they deliberately scroll higher, stop.
     */

    shouldFollowRef.current =
      distanceFromBottom <=
      100;
  }

  /* =======================================================
     AUTO SCROLL

     useLayoutEffect is deliberate here.

     It runs after React places the new messages into the
     DOM, but before the browser paints the frame.

     This prevents the page from loading at the top and then
     jumping incorrectly.
  ======================================================= */

  const latestMessageId =
    chat?.messages[
      chat.messages.length -
        1
    ]?.id ?? "";

  useLayoutEffect(() => {
    const element =
      messagesRef.current;

    if (
      !element ||
      !shouldFollowRef.current
    ) {
      return;
    }

    /*
     * Payment cards can change the final content height
     * slightly after React commits.
     *
     * Two animation frames gives the browser enough time
     * to finish calculating the full message area.
     */

    const firstFrame =
      window.requestAnimationFrame(
        () => {
          const secondFrame =
            window.requestAnimationFrame(
              () => {
                if (
                  !messagesRef.current
                ) {
                  return;
                }

                const current =
                  messagesRef.current;

                if (
                  initializedScrollRef.current
                ) {
                  current.scrollTo({
                    top:
                      current.scrollHeight,

                    behavior:
                      "smooth",
                  });
                } else {
                  /*
                   * Initial opening should land at the
                   * bottom instantly.
                   */

                  current.scrollTop =
                    current.scrollHeight;

                  initializedScrollRef.current =
                    true;
                }
              }
            );

          return () => {
            window.cancelAnimationFrame(
              secondFrame
            );
          };
        }
      );

    return () => {
      window.cancelAnimationFrame(
        firstFrame
      );
    };
  }, [
    latestMessageId,
  ]);

  /* =======================================================
     OPEN CHAT
  ======================================================= */

  async function handleOpenChat(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSubmitting(true);

    setError("");

    try {
      const response =
        await fetch(
          "/api/service-chat/open",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reference,
                contact,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to open chat."
        );
      }

      router.replace(
        `/service-chat?token=${encodeURIComponent(
          result.token
        )}`
      );
    } catch (
      problem
    ) {
      setError(
        problem instanceof
          Error
          ? problem.message
          : "Unable to open chat."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =======================================================
     SEND
  ======================================================= */

  async function handleSend(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmed =
      message.trim();

    if (
      !token ||
      !trimmed
    ) {
      return;
    }

    /*
     * Sending a message means the customer wants to return
     * to the newest portion of the conversation.
     */

    shouldFollowRef.current =
      true;

    setSubmitting(true);

    setError("");

    try {
      const response =
        await fetch(
          `/api/service-chat/${encodeURIComponent(
            token
          )}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                message:
                  trimmed,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to send message."
        );
      }

      const next =
        result as ChatData;

      const latest =
        next.messages.length >
        0
          ? next.messages[
              next.messages.length -
                1
            ]
          : null;

      if (latest) {
        lastMessageIdRef.current =
          latest.id;
      }

      setChat(next);

      setMessage("");
    } catch (
      problem
    ) {
      setError(
        problem instanceof
          Error
          ? problem.message
          : "Unable to send message."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =======================================================
     ENTER / SHIFT + ENTER
  ======================================================= */

  function handleMessageKeyDown(
    event:
      KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.nativeEvent
        .isComposing
    ) {
      return;
    }

    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        submitting ||
        !message.trim()
      ) {
        return;
      }

      event.currentTarget
        .form
        ?.requestSubmit();
    }
  }

  /* =======================================================
     CHECKOUT
  ======================================================= */

  async function handleCheckout(
    paymentRequestId:
      string
  ) {
    if (
      !token ||
      checkoutId
    ) {
      return;
    }

    setCheckoutId(
      paymentRequestId
    );

    setError("");

    try {
      const response =
        await fetch(
          `/api/service-chat/${encodeURIComponent(
            token
          )}/checkout`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                paymentRequestId,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.url
      ) {
        throw new Error(
          result.error ??
            "Unable to open secure checkout."
        );
      }

      window.location.assign(
        result.url
      );
    } catch (
      problem
    ) {
      setError(
        problem instanceof
          Error
          ? problem.message
          : "Unable to open secure checkout."
      );

      setCheckoutId(null);
    }
  }

  /* =======================================================
     ACCESS
  ======================================================= */

  if (!token) {
    return (
      <section
        className={
          styles.page
        }
      >
        <div
          className={
            styles.accessCard
          }
        >
          <span
            className={
              styles.eyebrow
            }
          >
            BIRDSHOP / SERVICE CHAT
          </span>

          <h1>
            Continue your service here.
          </h1>

          <p>
            Enter the service reference and the exact contact information used when the request was submitted.
          </p>

          <form
            onSubmit={
              handleOpenChat
            }
            className={
              styles.accessForm
            }
          >
            <label>
              <span>
                SERVICE REFERENCE
              </span>

              <input
                value={
                  reference
                }
                onChange={(
                  event
                ) =>
                  setReference(
                    event.target
                      .value
                  )
                }
                placeholder="BS-100003"
                required
              />
            </label>

            <label>
              <span>
                EMAIL / CONTACT
              </span>

              <input
                value={
                  contact
                }
                onChange={(
                  event
                ) =>
                  setContact(
                    event.target
                      .value
                  )
                }
                placeholder="The contact used on your request"
                required
              />
            </label>

            {error && (
              <div
                className={
                  styles.error
                }
              >
                {
                  error
                }
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting
              }
            >
              {submitting
                ? "Opening..."
                : "Open Service Chat"}
            </button>
          </form>

          <small>
            Once service checkout is fully connected, BirdShop can bring customers directly into their private service conversation.
          </small>
        </div>
      </section>
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading &&
    !chat
  ) {
    return (
      <section
        className={
          styles.page
        }
      >
        <div
          className={
            styles.loading
          }
        >
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
      <section
        className={
          styles.page
        }
      >
        <div
          className={
            styles.accessCard
          }
        >
          <span
            className={
              styles.eyebrow
            }
          >
            SERVICE CHAT
          </span>

          <h1>
            Conversation unavailable.
          </h1>

          <p>
            {error ||
              "The service conversation could not be opened."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.replace(
                "/service-chat"
              )
            }
          >
            Return to Service Chat
          </button>
        </div>
      </section>
    );
  }

  /* =======================================================
     PAYMENTS
  ======================================================= */

  const paymentMap =
    new Map(
      chat.payment_requests.map(
        (
          request
        ) => [
          request.id,
          request,
        ]
      )
    );

  const pendingPayment =
    chat.payment_requests.find(
      (
        request
      ) =>
        request.status ===
        "pending"
    ) ??
    null;

  const latestPayment =
    chat.payment_requests.length >
    0
      ? chat.payment_requests[
          chat.payment_requests.length -
            1
        ]
      : null;

  /* =======================================================
     MAIN CHAT
  ======================================================= */

  return (
    <section
      className={
        styles.page
      }
    >
      <div
        className={
          styles.workspace
        }
      >
        {/* ===============================================
            GREEN ORDER CARD
        =============================================== */}

        <aside
          className={
            styles.summary
          }
        >
          <span
            className={
              styles.eyebrow
            }
          >
            {
              chat.reference
            }
          </span>

          <h1>
            {chat.service_name ??
              "BirdShop Service"}
          </h1>

          <p
            className={
              styles.packageName
            }
          >
            {chat.package_name ??
              "Custom Service"}
          </p>

          <div
            className={
              styles.summaryFacts
            }
          >
            <div>
              <span>
                TOTAL
              </span>

              <strong>
                {money(
                  chat.total
                )}
              </strong>
            </div>

            <div>
              <span>
                PAYMENT
              </span>

              <strong>
                {statusLabel(
                  chat.payment_status
                )}
              </strong>
            </div>

            <div>
              <span>
                SERVICE STATUS
              </span>

              <strong>
                {statusLabel(
                  chat.service_status
                )}
              </strong>
            </div>
          </div>

          <div
            className={
              styles.futurePayment
            }
          >
            <span>
              PAYMENT
            </span>

            {chat.payment_status ===
            "paid" ? (
              <p>
                ✓ Payment received for this service.
              </p>
            ) : pendingPayment ? (
              <>
                <p>
                  A payment request is ready.
                </p>

                <strong>
                  {money(
                    pendingPayment.amount,
                    pendingPayment.currency
                  )}
                </strong>
              </>
            ) : latestPayment ? (
              <p>
                Latest request:{" "}
                {statusLabel(
                  latestPayment.status
                )}
              </p>
            ) : (
              <p>
                No payment request has been sent yet.
              </p>
            )}
          </div>
        </aside>

        {/* ===============================================
            CHAT
        =============================================== */}

        <section
          className={
            styles.chat
          }
        >
          <header
            className={
              styles.chatHeader
            }
          >
            <div>
              <span>
                PRIVATE SERVICE CHAT
              </span>

              <strong>
                BirdShop Support
              </strong>
            </div>

            <span
              className={
                styles.online
              }
            >
              WEBSITE CHAT
            </span>
          </header>

          {paymentResult ===
            "success" && (
            <div
              className={
                paymentStyles.notice
              }
              data-tone="success"
            >
              Payment submitted successfully. BirdShop is verifying it now.
            </div>
          )}

          {paymentResult ===
            "cancelled" && (
            <div
              className={
                paymentStyles.notice
              }
              data-tone="neutral"
            >
              Checkout was cancelled. Your service and conversation remain available.
            </div>
          )}

          {/* =============================================
              INTERNAL SCROLL AREA
          ============================================= */}

          <div
            ref={
              messagesRef
            }
            onScroll={
              handleMessagesScroll
            }
            className={
              styles.messages
            }
          >
            {chat.messages.length ===
            0 ? (
              <div
                className={
                  styles.empty
                }
              >
                Send the first message to BirdShop.
              </div>
            ) : (
              chat.messages.map(
                (
                  item
                ) => {
                  /* =====================================
                     PAYMENT
                  ===================================== */

                  if (
                    item.message_type ===
                    "payment_request"
                  ) {
                    const requestId =
                      paymentRequestIdFromMessage(
                        item
                      );

                    const request =
                      requestId
                        ? paymentMap.get(
                            requestId
                          )
                        : null;

                    if (request) {
                      const canPay =
                        request.status ===
                          "pending" &&
                        chat.payment_status !==
                          "paid";

                      return (
                        <article
                          key={
                            item.id
                          }
                          className={
                            paymentStyles.request
                          }
                          data-status={
                            request.status
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
                                BIRDSHOP PAYMENT REQUEST
                              </span>

                              <strong
                                className={
                                  paymentStyles.requestTitle
                                }
                              >
                                {
                                  request.title
                                }
                              </strong>
                            </div>

                            <span
                              className={
                                paymentStyles.requestStatus
                              }
                            >
                              {statusLabel(
                                request.status
                              )}
                            </span>
                          </div>

                          {request.description && (
                            <p
                              className={
                                paymentStyles.requestDescription
                              }
                            >
                              {
                                request.description
                              }
                            </p>
                          )}

                          <div
                            className={
                              paymentStyles.paymentLine
                            }
                          >
                            <strong
                              className={
                                paymentStyles.requestAmount
                              }
                            >
                              {money(
                                request.amount,
                                request.currency
                              )}
                            </strong>

                            {canPay ? (
                              <button
                                type="button"
                                className={
                                  paymentStyles.button
                                }
                                disabled={
                                  checkoutId !==
                                  null
                                }
                                onClick={() =>
                                  void handleCheckout(
                                    request.id
                                  )
                                }
                              >
                                {checkoutId ===
                                request.id
                                  ? "Opening Checkout..."
                                  : "Pay Securely"}
                              </button>
                            ) : request.status ===
                                "paid" ||
                              chat.payment_status ===
                                "paid" ? (
                              <strong
                                className={
                                  paymentStyles.paidLabel
                                }
                              >
                                ✓ Payment Received
                              </strong>
                            ) : null}
                          </div>

                          <div
                            className={
                              paymentStyles.requestFooter
                            }
                          >
                            <span>
                              {canPay
                                ? "Secure checkout powered by Stripe."
                                : request.status ===
                                    "cancelled"
                                  ? "This payment request was cancelled."
                                  : request.status ===
                                      "paid"
                                    ? "Payment confirmed."
                                    : "This payment request is no longer active."}
                            </span>
                          </div>

                          <small
                            className={
                              paymentStyles.safeNote
                            }
                          >
                            BirdShop never asks you to enter card information directly into chat.
                          </small>
                        </article>
                      );
                    }
                  }

                  /* =====================================
                     NORMAL CHAT
                  ===================================== */

                  return (
                    <article
                      key={
                        item.id
                      }
                      className={
                        item.sender_type ===
                        "admin"
                          ? styles.adminMessage
                          : item.sender_type ===
                              "system"
                            ? styles.systemMessage
                            : styles.customerMessage
                      }
                    >
                      <div>
                        <strong>
                          {item.sender_label ||
                            (item.sender_type ===
                            "admin"
                              ? "BirdShop"
                              : "Customer")}
                        </strong>

                        <span>
                          {formatMessageTime(
                            item.created_at
                          )}
                        </span>
                      </div>

                      <p>
                        {
                          item.body
                        }
                      </p>
                    </article>
                  );
                }
              )
            )}
          </div>

          {/* =============================================
              COMPOSER
          ============================================= */}

          {chat.conversation_status ===
          "open" ? (
            <form
              onSubmit={
                handleSend
              }
              className={
                styles.composer
              }
            >
              <textarea
                value={
                  message
                }
                onChange={(
                  event
                ) =>
                  setMessage(
                    event.target
                      .value
                  )
                }
                onKeyDown={
                  handleMessageKeyDown
                }
                placeholder="Message BirdShop..."
                maxLength={
                  4000
                }
                rows={2}
              />

              <div>
                {error ? (
                  <span
                    className={
                      styles.errorText
                    }
                  >
                    {
                      error
                    }
                  </span>
                ) : (
                  <span>
                    Enter to send · Shift + Enter for a new line
                  </span>
                )}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !message.trim()
                  }
                >
                  {submitting
                    ? "Sending..."
                    : "Send Message"}
                </button>
              </div>
            </form>
          ) : (
            <div
              className={
                styles.closed
              }
            >
              This service conversation has been closed.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}