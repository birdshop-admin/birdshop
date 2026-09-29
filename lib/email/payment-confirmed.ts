/* =========================================================
   BIRDSHOP

   PAYMENT CONFIRMED EMAILS

   Used only AFTER Stripe has verified the payment and
   BirdShop has successfully created/linked the real order.
========================================================= */

/* =========================================================
   TYPES
========================================================= */

export type PaymentConfirmedEmailData = {
  reference: string;

  orderReference: string;

  customerName:
    | string
    | null;

  customerEmail:
    string;

  serviceName:
    string;

  packageName:
    | string
    | null;

  amount:
    number;

  currency:
    string;

  paidAt:
    string;

  chatUrl:
    string;
};

export type PaymentConfirmedAdminEmailData =
  PaymentConfirmedEmailData & {
    adminUrl: string;

    paymentRequestId:
      string;

    orderId:
      string;

    stripeSessionId:
      string;
  };

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
  value:
    | string
    | number
    | null
    | undefined
) {
  return String(
    value ??
      ""
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
   MONEY
========================================================= */

function money(
  amount:
    number,
  currency:
    string
) {
  try {
    return new Intl
      .NumberFormat(
        "en-US",
        {
          style:
            "currency",

          currency:
            currency
              .trim()
              .toUpperCase(),
        }
      )
      .format(
        amount
      );
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(
      2
    )}`;
  }
}

/* =========================================================
   DATE
========================================================= */

function formatDate(
  value:
    string
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl
    .DateTimeFormat(
      "en-US",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      }
    )
    .format(
      date
    );
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
    border-bottom:1px solid #d8d3c4;
  "
>
  <tr>
    <td
      style="
        width:150px;
        padding:14px 0;
        vertical-align:top;
        color:#788075;
        font-size:9px;
        font-weight:700;
        letter-spacing:2px;
      "
    >
      ${escapeHtml(
        label
      )}
    </td>

    <td
      style="
        padding:14px 0;
        vertical-align:top;
        color:#17241c;
        font-size:14px;
        font-weight:600;
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
   EMAIL SHELL
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
  preview:
    string;

  eyebrow:
    string;

  title:
    string;

  intro:
    string;

  content:
    string;

  buttonLabel:
    string;

  buttonUrl:
    string;

  footer:
    string;
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
                  SECURE PAYMENTS
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
            BIRDSHOP · SECURE SERVICES
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/* =========================================================
   CUSTOMER PAYMENT RECEIPT
========================================================= */

export function paymentConfirmedCustomerEmail(
  data:
    PaymentConfirmedEmailData
) {
  const formattedAmount =
    money(
      data.amount,
      data.currency
    );

  const packageName =
    data.packageName ||
    "Custom Quote";

  const greeting =
    data.customerName
      ? `Hi ${data.customerName}, your BirdShop payment has been confirmed.`
      : "Your BirdShop payment has been confirmed.";

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
    "SERVICE",
    data.serviceName
  )}

  ${infoRow(
    "PACKAGE",
    packageName
  )}

  ${infoRow(
    "AMOUNT PAID",
    formattedAmount
  )}

  ${infoRow(
    "PAYMENT",
    "Confirmed"
  )}

  ${infoRow(
    "ORDER STATUS",
    "Active"
  )}

  ${infoRow(
    "PAID",
    formatDate(
      data.paidAt
    )
  )}
</div>

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
    WHAT HAPPENS NEXT
  </div>

  <div
    style="
      font-size:13px;
      line-height:1.8;
      color:#e3dfd2;
    "
  >
    Your service order is now active.
    Continue using your private BirdShop conversation for
    updates, questions, requirements, and delivery.
  </div>
</div>
`;

  const html =
    emailShell({
      preview:
        `${data.reference} · Payment confirmed`,

      eyebrow:
        "PAYMENT CONFIRMED",

      title:
        "Your service order is active.",

      intro:
        greeting,

      content,

      buttonLabel:
        "OPEN PRIVATE CONVERSATION",

      buttonUrl:
        data.chatUrl,

      footer:
        `Keep reference <strong>${escapeHtml(
          data.reference
        )}</strong> for your records. BirdShop will never ask you to send card information through chat.`,
    });

  const text = [
    "BIRDSHOP",
    "",
    "PAYMENT CONFIRMED",
    "",
    `Reference: ${data.reference}`,
    `Service: ${data.serviceName}`,
    `Package: ${packageName}`,
    `Amount Paid: ${formattedAmount}`,
    "Payment: Confirmed",
    "Order Status: Active",
    `Paid: ${formatDate(
      data.paidAt
    )}`,
    "",
    "Your service order is now active.",
    "Continue using your private BirdShop conversation for updates and delivery.",
    "",
    `Open Private Conversation: ${data.chatUrl}`,
  ].join(
    "\n"
  );

  return {
    subject:
      `${data.reference} · Payment confirmed`,

    html,

    text,
  };
}

/* =========================================================
   ADMIN PAYMENT NOTIFICATION
========================================================= */

export function paymentConfirmedAdminEmail(
  data:
    PaymentConfirmedAdminEmailData
) {
  const formattedAmount =
    money(
      data.amount,
      data.currency
    );

  const packageName =
    data.packageName ||
    "Custom Quote";

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
    "CUSTOMER",
    data.customerName ||
      "Customer"
  )}

  ${infoRow(
    "EMAIL",
    data.customerEmail
  )}

  ${infoRow(
    "SERVICE",
    data.serviceName
  )}

  ${infoRow(
    "PACKAGE",
    packageName
  )}

  ${infoRow(
    "AMOUNT",
    formattedAmount
  )}

  ${infoRow(
    "PAYMENT",
    "Stripe Verified"
  )}

  ${infoRow(
    "ORDER",
    data.orderReference
  )}

  ${infoRow(
    "PAID",
    formatDate(
      data.paidAt
    )
  )}
</div>

<div
  style="
    margin-top:22px;
    padding:18px 20px;
    background:#102018;
    color:#dfdbcf;
    border-radius:10px;
    font-size:13px;
    line-height:1.8;
  "
>
    Stripe verified the payment and BirdShop created the
    real service order. The conversation is now linked to
    order <strong>${escapeHtml(
      data.orderReference
    )}</strong>.
</div>
`;

  const html =
    emailShell({
      preview:
        `Payment received · ${data.reference} · ${formattedAmount}`,

      eyebrow:
        "BIRDSHOP PAYMENT",

      title:
        "A service payment was received.",

      intro:
        "Stripe verified the payment and the service order is now active.",

      content,

      buttonLabel:
        "OPEN ADMIN CHAT",

      buttonUrl:
        data.adminUrl,

      footer:
        "This is an automated BirdShop payment notification. Payment state should be managed through BirdShop and Stripe rather than email.",
    });

  const text = [
    "BIRDSHOP ADMIN",
    "",
    "SERVICE PAYMENT RECEIVED",
    "",
    `Reference: ${data.reference}`,
    `Customer: ${data.customerName || "Customer"}`,
    `Email: ${data.customerEmail}`,
    `Service: ${data.serviceName}`,
    `Package: ${packageName}`,
    `Amount: ${formattedAmount}`,
    `Order: ${data.orderReference}`,
    `Paid: ${formatDate(
      data.paidAt
    )}`,
    "",
    `Admin Chat: ${data.adminUrl}`,
    "",
    `Payment Request ID: ${data.paymentRequestId}`,
    `Order ID: ${data.orderId}`,
  ].join(
    "\n"
  );

  return {
    subject:
      `Payment received · ${data.reference} · ${formattedAmount}`,

    html,

    text,
  };
}