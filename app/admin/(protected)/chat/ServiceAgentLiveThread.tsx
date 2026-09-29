"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  sendServiceAgentMessage,
} from "./agent-actions";

import styles from "./chat.module.css";

/* =========================================================
   TYPES
========================================================= */

export type ServiceAgentMessage = {
  id:
    string;

  conversation_id:
    string;

  sender_type:
    string;

  sender_label:
    | string
    | null;

  body:
    string;

  message_type:
    string;

  metadata:
    Record<
      string,
      unknown
    >;

  created_at:
    string;
};

type OptimisticMessage =
  ServiceAgentMessage & {
    optimistic?:
      boolean;
  };

type ServiceAgentLiveThreadProps = {
  conversationId:
    string;

  initialMessages:
    ServiceAgentMessage[];
};

/* =========================================================
   SETTINGS
========================================================= */

const FALLBACK_SYNC_MS =
  1000;

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

function sortMessages<
  T extends
    ServiceAgentMessage
>(
  messages:
    T[]
) {
  return [
    ...messages,
  ].sort(
    (
      a,
      b
    ) =>
      new Date(
        a.created_at
      ).getTime() -
      new Date(
        b.created_at
      ).getTime()
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ServiceAgentLiveThread({
  conversationId,
  initialMessages,
}: ServiceAgentLiveThreadProps) {
  const supabase =
    createClient();

  const [
    messages,
    setMessages,
  ] =
    useState<
      OptimisticMessage[]
    >(
      initialMessages
    );

  const [
    body,
    setBody,
  ] =
    useState("");

  const [
    sending,
    setSending,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null
    );

  const messagesRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const followBottomRef =
    useRef(
      true
    );

  const scrollInitializedRef =
    useRef(
      false
    );

  /* =======================================================
     SCROLL
  ======================================================= */

  function handleScroll() {
    const element =
      messagesRef.current;

    if (
      !element ||
      !scrollInitializedRef.current
    ) {
      return;
    }

    const distance =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    followBottomRef.current =
      distance <=
      110;
  }

  const latestMessageId =
    messages.length >
    0
      ? messages[
          messages.length -
            1
        ].id
      : "";

  useLayoutEffect(() => {
    const element =
      messagesRef.current;

    if (
      !element ||
      !followBottomRef.current
    ) {
      return;
    }

    element.scrollTop =
      element.scrollHeight;

    const frame =
      window
        .requestAnimationFrame(
          () => {
            const current =
              messagesRef.current;

            if (
              !current ||
              !followBottomRef.current
            ) {
              return;
            }

            current.scrollTop =
              current.scrollHeight;

            scrollInitializedRef.current =
              true;
          }
        );

    return () => {
      window
        .cancelAnimationFrame(
          frame
        );
    };
  }, [
    latestMessageId,
  ]);

  /* =======================================================
     RECONCILE
  ======================================================= */

  const reconcileMessages =
    useCallback(
      (
        incoming:
          ServiceAgentMessage[]
      ) => {
        setMessages(
          (
            current
          ) => {
            const next =
              [
                ...incoming,
              ] as
                OptimisticMessage[];

            const optimistic =
              current.filter(
                (
                  item
                ) =>
                  item.optimistic
              );

            for (
              const temp
              of optimistic
            ) {
              const matchingReal =
                incoming.find(
                  (
                    item
                  ) =>
                    item.sender_type ===
                      "admin" &&
                    item.body ===
                      temp.body &&
                    Math.abs(
                      new Date(
                        item.created_at
                      ).getTime() -
                        new Date(
                          temp.created_at
                        ).getTime()
                    ) <
                      30000
                );

              if (
                !matchingReal
              ) {
                next.push(
                  temp
                );
              }
            }

            return sortMessages(
              next
            );
          }
        );
      },
      []
    );

  /* =======================================================
     DIRECT SYNC
  ======================================================= */

  const syncMessages =
    useCallback(
      async () => {
        const {
          data,

          error:
            messageError,
        } =
          await supabase
            .from(
              "service_messages"
            )
            .select(
              "id, conversation_id, sender_type, sender_label, body, message_type, metadata, created_at"
            )
            .eq(
              "conversation_id",
              conversationId
            )
            .order(
              "created_at",
              {
                ascending:
                  true,
              }
            );

        if (
          messageError ||
          !data
        ) {
          return;
        }

        reconcileMessages(
          data as unknown as
            ServiceAgentMessage[]
        );
      },
      [
        supabase,
        conversationId,
        reconcileMessages,
      ]
    );

  /* =======================================================
     REALTIME + FALLBACK
  ======================================================= */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          `birdshop-service-agent-${conversationId}`
        )
        .on(
          "postgres_changes",
          {
            event:
              "INSERT",

            schema:
              "public",

            table:
              "service_messages",

            filter:
              `conversation_id=eq.${conversationId}`,
          },
          (
            payload
          ) => {
            const incoming =
              payload.new as
                ServiceAgentMessage;

            setMessages(
              (
                current
              ) => {
                if (
                  current.some(
                    (
                      item
                    ) =>
                      item.id ===
                      incoming.id
                  )
                ) {
                  return current;
                }

                const optimisticIndex =
                  current.findIndex(
                    (
                      item
                    ) =>
                      item.optimistic &&
                      item.sender_type ===
                        "admin" &&
                      item.body ===
                        incoming.body
                  );

                if (
                  optimisticIndex >=
                  0
                ) {
                  const next =
                    [
                      ...current,
                    ];

                  next[
                    optimisticIndex
                  ] =
                    incoming;

                  return sortMessages(
                    next
                  );
                }

                return sortMessages([
                  ...current,
                  incoming,
                ]);
              }
            );
          }
        )
        .subscribe();

    const fallback =
      window.setInterval(
        () => {
          void syncMessages();
        },
        FALLBACK_SYNC_MS
      );

    return () => {
      window.clearInterval(
        fallback
      );

      void supabase
        .removeChannel(
          channel
        );
    };
  }, [
    supabase,
    conversationId,
    syncMessages,
  ]);

  /* =======================================================
     FOCUS
  ======================================================= */

  function focusComposer() {
    window
      .requestAnimationFrame(
        () => {
          textareaRef.current
            ?.focus({
              preventScroll:
                true,
            });
        }
      );
  }

  /* =======================================================
     SEND
  ======================================================= */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmed =
      body.trim();

    if (
      !trimmed ||
      sending
    ) {
      focusComposer();

      return;
    }

    followBottomRef.current =
      true;

    const optimisticId =
      `agent-${window.crypto.randomUUID()}`;

    const optimisticMessage:
      OptimisticMessage = {
      id:
        optimisticId,

      conversation_id:
        conversationId,

      sender_type:
        "admin",

      sender_label:
        "BirdShop",

      body:
        trimmed,

      message_type:
        "text",

      metadata: {},

      created_at:
        new Date()
          .toISOString(),

      optimistic:
        true,
    };

    setMessages(
      (
        current
      ) =>
        sortMessages([
          ...current,
          optimisticMessage,
        ])
    );

    setBody("");

    setError("");

    setSending(
      true
    );

    const formData =
      new FormData();

    formData.set(
      "conversation_id",
      conversationId
    );

    formData.set(
      "body",
      trimmed
    );

    try {
      const result =
        await sendServiceAgentMessage(
          formData
        );

      if (
        !result.ok
      ) {
        setMessages(
          (
            current
          ) =>
            current.filter(
              (
                item
              ) =>
                item.id !==
                optimisticId
            )
        );

        setBody(
          trimmed
        );

        setError(
          result.error
        );

        return;
      }

      await syncMessages();
    } catch (
      problem
    ) {
      setMessages(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.id !==
                optimisticId
          )
      );

      setBody(
        trimmed
      );

      setError(
        problem instanceof
          Error
          ? problem.message
          : "Unable to send message."
      );
    } finally {
      setSending(
        false
      );

      focusComposer();
    }
  }

  /* =======================================================
     ENTER TO SEND
  ======================================================= */

  function handleKeyDown(
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
        sending ||
        !body.trim()
      ) {
        return;
      }

      event.currentTarget
        .form
        ?.requestSubmit();
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <>
      <div
        ref={
          messagesRef
        }
        className={
          styles.messages
        }
        onScroll={
          handleScroll
        }
      >
        {messages.length ===
        0 ? (
          <div
            className={
              styles.emptyChat
            }
          >
            No messages yet.
          </div>
        ) : (
          messages.map(
            (
              item
            ) => (
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
                data-optimistic={
                  item.optimistic
                    ? "true"
                    : undefined
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
                    {item.optimistic
                      ? "Sending..."
                      : formatDate(
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
            )
          )
        )}
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className={
          styles.composer
        }
      >
        <textarea
          ref={
            textareaRef
          }
          value={
            body
          }
          onChange={(
            event
          ) =>
            setBody(
              event.target
                .value
            )
          }
          onKeyDown={
            handleKeyDown
          }
          placeholder="Reply to the customer..."
          rows={2}
          maxLength={
            4000
          }
          autoComplete="off"
          data-admin-chat-composer="true"
        />

        <div>
          {error ? (
            <span>
              {
                error
              }
            </span>
          ) : (
            <span>
              Service conversation only · Enter to send
            </span>
          )}

          <button
            type="submit"
            disabled={
              sending ||
              !body.trim()
            }
          >
            {sending
              ? "Sending..."
              : "Send Reply"}
          </button>
        </div>
      </form>
    </>
  );
}