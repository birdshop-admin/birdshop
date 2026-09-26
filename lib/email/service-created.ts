/* =========================================================
   BIRDSHOP
   CONVERSATION CREATED EMAILS

   NOTE:
   The filename is temporarily still "service-created.ts"
   so we do not have to reorganize the project mid-migration.

   These templates now support:

   service
   product
   general
========================================================= */

export type ConversationType =
  | "service"
  | "product"
  | "general";

export type ConversationCreatedEmailData = {
  reference: string;

  conversationType:
    ConversationType;

  customerName:
    | string
    | null;

  customerEmail:
    | string
    | null;

  customerContact:
    | string
    | null;

  subject:
    | string
    | null;

  requestMessage:
    | string
    | null;

  serviceName:
    | string
    | null;

  packageName:
    | string
    | null;

  productName:
    | string
    | null;

  productPlatform:
    | string
    | null;

  productRegion:
    | string
    | null;

  chatUrl: string;

  recoveryUrl: string;
};

export type ConversationCreatedAdminEmailData =
  ConversationCreatedEmailData & {
    adminUrl: string;
  };

/* =========================================================
   ESCAPE
========================================================= */

function escapeHtml(
  value:
    | string
    | null
    | undefined
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

/* =========================================================
   MESSAGE
========================================================= */

function shortenMessage(
  value:
    | string
    | null
    | undefined,
  maxLength =
    1200
) {
  const cleaned =
    String(
      value ?? ""
    ).trim();

  if (
    cleaned.length <=
    maxLength
  ) {
    return cleaned;
  }

  return `${cleaned.slice(
    0,
    maxLength
  )}…`;
}

function preserveLines(
  value:
    string
) {
  return escapeHtml(
    value
  ).replaceAll(
    "\n",
    "<br />"
  );
}

/* =========================================================
   LABELS
========================================================= */

function conversationLabel(
  type:
    ConversationType
) {
  if (
    type ===
    "product"
  ) {
    return "Product Support";
  }

  if (
    type ===
    "general"
  ) {
    return "General Support";
  }

  return "Service Request";
}

function conversationEyebrow(
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

  return "CUSTOM SERVICE REQUEST";
}

function getTitle(
  data:
    ConversationCreatedEmailData
) {
  if (
    data.conversationType ===
    "product"
  ) {
    return (
      data.productName ||
      data.subject ||
      "Product Support"
    );
  }

  if (
    data.conversationType ===
    "general"
  ) {
    return (
      data.subject ||
      "General Support"
    );
  }

  return (
    data.serviceName ||
    data.subject ||
    "Custom Service Request"
  );
}

function getDetail(
  data:
    ConversationCreatedEmailData
) {
  if (
    data.conversationType ===
    "product"
  ) {
    return [
      data.productPlatform,
      data.productRegion,
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      );
  }

  if (
    data.conversationType ===
    "service"
  ) {
    return (
      data.packageName ||
      "Custom Quote"
    );
  }

  return "Private BirdShop Support";
}

/* =========================================================
   BASE EMAIL SHELL
========================================================= */

function emailShell({
  preview,
  eyebrow,
  title,
  intro,
  content,
  buttonLabel,
  buttonUrl,
  footer,
}: {
  preview: string;

  eyebrow: string;

  title: string;

  intro: string;

  content: string;

  buttonLabel: string;

  buttonUrl: string;

  footer: string;
}) {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />

    <title>${escapeHtml(
      preview
    )}</title>
  </head>

  <body
    style="
      margin:0;
      padding:0;
      background:#08110b;
      color:#f0ede2;
      font-family:Arial,Helvetica,sans-serif;
    "
  >
    <div
      style="
        display:none;
        max-height:0;
        overflow:hidden;
        opacity:0;
      "
    >
      ${escapeHtml(
        preview
      )}
    </div>

    <table
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      role="presentation"
      style="
        width:100%;
        background:#08110b;
      "
    >
      <tr>
        <td
          align="center"
          style="
            padding:42px 16px;
          "
        >
          <table
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            role="presentation"
            style="
              width:100%;
              max-width:650px;
              background:#f1eee4;
              color:#102018;
              border-radius:18px;
              overflow:hidden;
              border:1px solid rgba(234,230,214,.18);
            "
          >
            <tr>
              <td
                style="
                  padding:28px 34px;
                  background:#102018;
                  color:#f1eee4;
                  border-bottom:1px solid rgba(241,238,228,.12);
                "
              >
                <div
                  style="
                    font-size:11px;
                    letter-spacing:4px;
                    font-weight:700;
                    color:#aeb99f;
                  "
                >
                  BIRDSHOP
                </div>

                <div
                  style="
                    margin-top:7px;
                    font-size:13px;
                    letter-spacing:2px;
                    color:#d9d5c7;
                  "
                >
                  PRIVATE CONVERSATIONS
                </div>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:42px 34px 18px;
                "
              >
                <div
                  style="
                    font-size:10px;
                    font-weight:700;
                    letter-spacing:3px;
                    color:#63745f;
                  "
                >
                  ${escapeHtml(
                    eyebrow
                  )}
                </div>

                <h1
                  style="
                    margin:14px 0 12px;
                    font-family:Georgia,'Times New Roman',serif;
                    font-weight:400;
                    font-size:38px;
                    line-height:1.08;
                    color:#0d2117;
                  "
                >
                  ${escapeHtml(
                    title
                  )}
                </h1>

                <p
                  style="
                    margin:0;
                    font-size:15px;
                    line-height:1.75;
                    color:#58645a;
                  "
                >
                  ${escapeHtml(
                    intro
                  )}
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:14px 34px 8px;
                "
              >
                ${content}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:28px 34px 38px;
                "
              >
                <a
                  href="${escapeHtml(
                    buttonUrl
                  )}"
                  style="
                    display:block;
                    background:#40563c;
                    color:#f7f2e7;
                    text-decoration:none;
                    text-align:center;
                    padding:17px 22px;
                    border-radius:7px;
                    font-size:13px;
                    line-height:1;
                    font-weight:700;
                    letter-spacing:1.4px;
                  "
                >
                  ${escapeHtml(
                    buttonLabel
                  )}
                </a>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:22px 34px 30px;
                  border-top:1px solid #d8d3c4;
                  background:#e8e4d8;
                "
              >
                <p
                  style="
                    margin:0;
                    color:#6d746c;
                    font-size:12px;
                    line-height:1.7;
                  "
                >
                  ${footer}
                </p>
              </td>
            </tr>
          </table>

          <div
            style="
              margin-top:20px;
              color:#778078;
              font-size:10px;
              letter-spacing:2px;
            "
          >
            BIRDSHOP · PRIVATE SUPPORT
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/* =========================================================
   INFO ROW
========================================================= */

function infoRow(
  label:
    string,
  value:
    string
) {
  return `
<table
  width="100%"
  cellspacing="0"
  cellpadding="0"
  border="0"
  role="presentation"
  style="
    border-bottom:1px solid #d9d5c8;
  "
>
  <tr>
    <td
      style="
        width:155px;
        padding:13px 0;
        font-size:9px;
        letter-spacing:2px;
        font-weight:700;
        color:#788075;
        vertical-align:top;
      "
    >
      ${escapeHtml(
        label
      )}
    </td>

    <td
      style="
        padding:13px 0;
        font-size:14px;
        font-weight:600;
        color:#17241c;
        vertical-align:top;
      "
    >
      ${escapeHtml(
        value
      )}
    </td>
  </tr>
</table>
`;
}

/* =========================================================
   CUSTOMER EMAIL
========================================================= */

export function conversationCreatedCustomerEmail(
  data:
    ConversationCreatedEmailData
) {
  const label =
    conversationLabel(
      data.conversationType
    );

  const title =
    getTitle(
      data
    );

  const detail =
    getDetail(
      data
    );

  const requestMessage =
    shortenMessage(
      data.requestMessage
    );

  const greeting =
    data.customerName
      ? `Hi ${data.customerName}, your BirdShop conversation is ready.`
      : "Your BirdShop conversation is ready.";

  const content = `
<div
  style="
    border:1px solid #d8d3c4;
    border-radius:10px;
    padding:4px 20px;
    background:#ebe7dc;
  "
>
  ${infoRow(
    "REFERENCE",
    data.reference
  )}

  ${infoRow(
    "TYPE",
    label
  )}

  ${infoRow(
    "SUBJECT",
    title
  )}

  ${
    detail
      ? infoRow(
          "DETAIL",
          detail
        )
      : ""
  }

  ${infoRow(
    "ORDER",
    data.conversationType ===
      "service"
      ? "Not created yet"
      : "Not required"
  )}
</div>

${
  requestMessage
    ? `
<div
  style="
    margin-top:22px;
    padding:20px;
    border:1px solid #d8d3c4;
    border-radius:10px;
    background:#f7f4eb;
  "
>
  <div
    style="
      margin-bottom:10px;
      font-size:9px;
      font-weight:700;
      letter-spacing:2px;
      color:#788075;
    "
  >
    YOUR MESSAGE
  </div>

  <div
    style="
      color:#263129;
      font-size:14px;
      line-height:1.7;
    "
  >
    ${preserveLines(
      requestMessage
    )}
  </div>
</div>
`
    : ""
}

<div
  style="
    margin-top:22px;
    padding:20px;
    border-radius:10px;
    background:#102018;
    color:#f1eee4;
  "
>
  <div
    style="
      margin-bottom:9px;
      color:#aeb99f;
      font-size:9px;
      font-weight:700;
      letter-spacing:2px;
    "
  >
    RETURNING LATER?
  </div>

  <div
    style="
      font-size:13px;
      line-height:1.7;
      color:#e3dfd2;
    "
  >
    Keep reference
    <strong>${escapeHtml(
      data.reference
    )}</strong>.
    You can return to BirdShop Private Chat later using
    this reference and the email address used on your request.
  </div>
</div>
`;

  const html =
    emailShell({
      preview:
        `${data.reference} · Your BirdShop conversation is ready`,

      eyebrow:
        conversationEyebrow(
          data.conversationType
        ),

      title:
        "Your private conversation is ready.",

      intro:
        greeting,

      content,

      buttonLabel:
        "OPEN PRIVATE CHAT",

      buttonUrl:
        data.chatUrl,

      footer:
        `If the private link is unavailable later, visit <a href="${escapeHtml(
          data.recoveryUrl
        )}" style="color:#40563c;">BirdShop Private Chat</a> and enter reference <strong>${escapeHtml(
          data.reference
        )}</strong> with the email used when you contacted BirdShop.`,
    });

  const text = [
    "BIRDSHOP",
    "",
    "PRIVATE CONVERSATION CREATED",
    "",
    `Reference: ${data.reference}`,
    `Type: ${label}`,
    `Subject: ${title}`,
    detail
      ? `Detail: ${detail}`
      : "",
    "",
    requestMessage
      ? "Your message:"
      : "",
    requestMessage,
    "",
    data.conversationType ===
    "service"
      ? "No order has been created yet. BirdShop will discuss scope, price, timing, and payment with you in chat."
      : "This is a private BirdShop support conversation.",
    "",
    `Open Private Chat: ${data.chatUrl}`,
    "",
    `Recovery: ${data.recoveryUrl}`,
    `Reference: ${data.reference}`,
  ]
    .filter(
      Boolean
    )
    .join(
      "\n"
    );

  return {
    subject:
      `${data.reference} · ${label} received`,

    html,

    text,
  };
}

/* =========================================================
   ADMIN EMAIL
========================================================= */

export function conversationCreatedAdminEmail(
  data:
    ConversationCreatedAdminEmailData
) {
  const label =
    conversationLabel(
      data.conversationType
    );

  const title =
    getTitle(
      data
    );

  const detail =
    getDetail(
      data
    );

  const requestMessage =
    shortenMessage(
      data.requestMessage,
      1800
    );

  const content = `
<div
  style="
    border:1px solid #d8d3c4;
    border-radius:10px;
    padding:4px 20px;
    background:#ebe7dc;
  "
>
  ${infoRow(
    "REFERENCE",
    data.reference
  )}

  ${infoRow(
    "TYPE",
    label
  )}

  ${infoRow(
    "CUSTOMER",
    data.customerName ||
      "Customer"
  )}

  ${infoRow(
    "EMAIL",
    data.customerEmail ||
      "—"
  )}

  ${
    data.customerContact
      ? infoRow(
          "DISCORD / CONTACT",
          data.customerContact
        )
      : ""
  }

  ${infoRow(
    "SUBJECT",
    title
  )}

  ${
    detail
      ? infoRow(
          "DETAIL",
          detail
        )
      : ""
  }

  ${infoRow(
    "ORDER",
    "Not created"
  )}
</div>

${
  requestMessage
    ? `
<div
  style="
    margin-top:22px;
    padding:20px;
    border:1px solid #d8d3c4;
    border-radius:10px;
    background:#f7f4eb;
  "
>
  <div
    style="
      margin-bottom:10px;
      font-size:9px;
      font-weight:700;
      letter-spacing:2px;
      color:#788075;
    "
  >
    CUSTOMER MESSAGE
  </div>

  <div
    style="
      color:#263129;
      font-size:14px;
      line-height:1.7;
    "
  >
    ${preserveLines(
      requestMessage
    )}
  </div>
</div>
`
    : ""
}

<div
  style="
    margin-top:22px;
    padding:18px 20px;
    background:#102018;
    color:#dfdbcf;
    border-radius:10px;
    font-size:13px;
    line-height:1.7;
  "
>
    This conversation exists independently of an order.
    ${
      data.conversationType ===
      "service"
        ? "Discuss the job and send a payment request from Admin Chat. The order will be created later after verified payment."
        : "Handle this request directly through Admin Chat."
    }
</div>
`;

  const html =
    emailShell({
      preview:
        `New ${label} · ${data.reference}`,

      eyebrow:
        "NEW BIRDSHOP CONVERSATION",

      title:
        title,

      intro:
        `${label} was created and is waiting in Admin Chat.`,

      content,

      buttonLabel:
        "OPEN ADMIN CHAT",

      buttonUrl:
        data.adminUrl,

      footer:
        "This is an automated BirdShop administration notification. Customer replies should be handled from Admin Chat.",
    });

  const text = [
    "BIRDSHOP ADMIN",
    "",
    "NEW PRIVATE CONVERSATION",
    "",
    `Reference: ${data.reference}`,
    `Type: ${label}`,
    `Customer: ${data.customerName || "Customer"}`,
    `Email: ${data.customerEmail || "—"}`,
    data.customerContact
      ? `Contact: ${data.customerContact}`
      : "",
    `Subject: ${title}`,
    detail
      ? `Detail: ${detail}`
      : "",
    "",
    requestMessage
      ? "Customer message:"
      : "",
    requestMessage,
    "",
    "No order has been created.",
    "",
    `Admin Chat: ${data.adminUrl}`,
  ]
    .filter(
      Boolean
    )
    .join(
      "\n"
    );

  return {
    subject:
      `New ${label} · ${data.reference}`,

    html,

    text,
  };
}