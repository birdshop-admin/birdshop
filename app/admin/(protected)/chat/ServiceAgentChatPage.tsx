import Link from "next/link";

import AdminSidebar from "@/components/AdminSidebar";

import {
  createClient,
} from "@/lib/supabase/server";

import ServiceAgentLiveThread, {
  type ServiceAgentMessage,
} from "./ServiceAgentLiveThread";

import styles from "./chat.module.css";

/* =========================================================
   TYPES
========================================================= */

type ServiceConversation = {
  id:
    string;

  reference:
    string;

  conversation_type:
    "service";

  workflow_status:
    string;

  status:
    string;

  last_message_at:
    string;

  last_sender_type:
    | string
    | null;

  admin_last_read_at:
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
};

type PageProps = {
  searchParams:
    Promise<{
      conversation?:
        string;
    }>;
};

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
        character
          .toUpperCase()
    );
}

function isUnread(
  conversation:
    ServiceConversation
) {
  if (
    conversation
      .last_sender_type !==
    "customer"
  ) {
    return false;
  }

  if (
    !conversation
      .admin_last_read_at
  ) {
    return true;
  }

  return (
    new Date(
      conversation
        .last_message_at
    ).getTime() >
    new Date(
      conversation
        .admin_last_read_at
    ).getTime()
  );
}

function conversationTitle(
  conversation:
    ServiceConversation
) {
  return (
    conversation.service_name ||
    conversation.subject ||
    "Custom Service Request"
  );
}

function conversationSubtitle(
  conversation:
    ServiceConversation
) {
  return (
    conversation.package_name ||
    "Custom Quote"
  );
}

function customerName(
  conversation:
    ServiceConversation
) {
  return (
    conversation.customer_name ||
    "Customer"
  );
}

function customerContact(
  conversation:
    ServiceConversation
) {
  return (
    conversation.customer_contact ||
    conversation.customer_email ||
    "No contact available"
  );
}

function buildConversationHref(
  id:
    string
) {
  const params =
    new URLSearchParams();

  params.set(
    "view",
    "active"
  );

  params.set(
    "type",
    "service"
  );

  params.set(
    "conversation",
    id
  );

  return `/admin/chat?${params.toString()}`;
}

/* =========================================================
   SERVICE AGENT CHAT
========================================================= */

export default async function ServiceAgentChatPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  /* =======================================================
     SERVICE CONVERSATIONS ONLY
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
          service_name,
          package_name
        `
      )
      .eq(
        "conversation_type",
        "service"
      )
      .eq(
        "status",
        "open"
      )
      .is(
        "deleted_at",
        null
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
      `Unable to load service conversations: ${conversationError.message}`
    );
  }

  const conversations =
    (
      conversationData ??
      []
    ) as unknown as
      ServiceConversation[];

  /* =======================================================
     SELECTED CHAT

     Selection is only allowed from the already-filtered
     service conversation list.
  ======================================================= */

  const selected =
    conversations.find(
      (
        conversation
      ) =>
        conversation.id ===
        params.conversation
    ) ??
    conversations[0] ??
    null;

  /* =======================================================
     MESSAGES
  ======================================================= */

  let messages:
    ServiceAgentMessage[] =
      [];

  if (
    selected
  ) {
    const {
      data,

      error,
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
          selected.id
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          }
        );

    if (
      error
    ) {
      throw new Error(
        `Unable to load service messages: ${error.message}`
      );
    }

    messages =
      (
        data ??
        []
      ) as unknown as
        ServiceAgentMessage[];

    /* =====================================================
       MARK READ

       Uses the restricted staff RPC.

       Service Agent never receives generic UPDATE access.
    ===================================================== */

    if (
      isUnread(
        selected
      )
    ) {
      await supabase.rpc(
        "birdshop_staff_mark_service_chat_read",
        {
          p_conversation_id:
            selected.id,
        }
      );
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main
      className={
        styles.page
      }
    >
      <AdminSidebar
        role="service_agent"
      />

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
              BIRDSHOP / SERVICE STAFF
            </span>

            <h1>
              Service Chat
            </h1>

            <p>
              Handle active customer service conversations.
              Payments, orders, products, inventory and
              administration remain owner-only.
            </p>
          </div>
        </header>

        {/* =================================================
            STAFF ACCESS BAR
        ================================================= */}

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
              STAFF ACCESS
            </span>

            <strong>
              Service conversations only
            </strong>
          </div>

          <strong>
            LIMITED
          </strong>
        </div>

        {/* =================================================
            WORKSPACE
        ================================================= */}

        <div
          className={
            styles.workspace
          }
        >
          {/* ===============================================
              INBOX
          =============================================== */}

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
                SERVICE INBOX
              </span>

              <strong>
                {
                  conversations.length
                }{" "}
                {conversations.length ===
                1
                  ? "conversation"
                  : "conversations"}
              </strong>
            </div>

            {conversations.length ===
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
                {conversations.map(
                  (
                    conversation
                  ) => {
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
                          buildConversationHref(
                            conversation.id
                          )
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
                            SERVICE ·{" "}
                            {
                              conversation.reference
                            }
                          </span>

                          {unread && (
                            <small>
                              NEW
                            </small>
                          )}
                        </div>

                        <strong>
                          {conversationTitle(
                            conversation
                          )}
                        </strong>

                        <p>
                          {customerName(
                            conversation
                          )}

                          {" · "}

                          {conversationSubtitle(
                            conversation
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

          {/* ===============================================
              CHAT
          =============================================== */}

          {!selected ? (
            <section
              className={
                styles.emptyChat
              }
            >
              No service conversations are waiting.
            </section>
          ) : (
            <section
              className={
                styles.chat
              }
            >
              {/* ===========================================
                  CHAT HEADER
              =========================================== */}

              <header
                className={
                  styles.chatHeader
                }
              >
                <div>
                  <span>
                    SERVICE ·{" "}
                    {
                      selected.reference
                    }
                  </span>

                  <h2>
                    {conversationTitle(
                      selected
                    )}
                  </h2>

                  <p>
                    {conversationSubtitle(
                      selected
                    )}
                  </p>
                </div>

                <div
                  className={
                    styles.orderFacts
                  }
                >
                  <div>
                    <span>
                      ACCESS
                    </span>

                    <strong>
                      Service
                    </strong>
                  </div>

                  <div>
                    <span>
                      CHAT
                    </span>

                    <strong>
                      Open
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
                </div>
              </header>

              {/* ===========================================
                  CUSTOMER
              =========================================== */}

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
                    {customerName(
                      selected
                    )}
                  </strong>

                  <small>
                    {customerContact(
                      selected
                    )}
                  </small>
                </div>

                <span>
                  {
                    selected.reference
                  }
                </span>
              </div>

              {/* ===========================================
                  SECURITY / ACCESS INFORMATION
              =========================================== */}

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
                    SERVICE WORKSPACE
                  </span>

                  <strong>
                    Customer communication
                  </strong>
                </div>

                <span>
                  CHAT ONLY
                </span>
              </div>

              {/* ===========================================
                  LIVE THREAD
              =========================================== */}

              <ServiceAgentLiveThread
                key={
                  selected.id
                }
                conversationId={
                  selected.id
                }
                initialMessages={
                  messages
                }
              />

              {/* ===========================================
                  FOOTER
              =========================================== */}

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
                  <span>
                    Service Staff
                  </span>
                </div>

                <span>
                  Payments and administration are owner-only
                </span>
              </footer>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}