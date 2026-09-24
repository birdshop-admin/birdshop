/* =========================================================
   BIRDSHOP
   SERVICE CREATED EMAILS

   Shared transactional email templates for:

   1. Customer service-request confirmation
   2. BirdShop admin notification

   Later email templates can follow this same foundation.
========================================================= */

/* =========================================================
   TYPES
========================================================= */

export type ServiceCreatedEmailData = {
  reference: string;

  customerName:
    | string
    | null;

  serviceName:
    | string
    | null;

  packageName:
    | string
    | null;

  total:
    | number
    | string
    | null;

  requestMessage:
    | string
    | null;

  chatUrl: string;
};

export type ServiceCreatedAdminEmailData =
  ServiceCreatedEmailData & {
    customerEmail:
      | string
      | null;

    customerContact:
      | string
      | null;

    adminUrl: string;
  };

/* =========================================================
   HELPERS
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

function formatMoney(
  value:
    | number
    | string
    | null
) {
  if (
    value === null ||
    value === ""
  ) {
    return "To be confirmed";
  }

  const amount =
    Number(
      value
    );

  if (
    !Number.isFinite(
      amount
    )
  ) {
    return "To be confirmed";
  }

  return amount.toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",
    }
  );
}

function shortenMessage(
  value:
    | string
    | null
) {
  const message =
    value
      ?.trim() ??
    "";

  if (!message) {
    return "No additional request details were provided.";
  }

  if (
    message.length <=
    700
  ) {
    return message;
  }

  return `${message.slice(
    0,
    697
  )}...`;
}

function preserveLines(
  value: string
) {
  return escapeHtml(
    value
  ).replaceAll(
    "\n",
    "<br />"
  );
}

/* =========================================================
   CUSTOMER EMAIL
========================================================= */

export function serviceCreatedCustomerEmail(
  data:
    ServiceCreatedEmailData
) {
  const customerName =
    escapeHtml(
      data.customerName ||
        "Customer"
    );

  const reference =
    escapeHtml(
      data.reference
    );

  const serviceName =
    escapeHtml(
      data.serviceName ||
        "BirdShop Service"
    );

  const packageName =
    escapeHtml(
      data.packageName ||
        "Custom Package"
    );

  const price =
    escapeHtml(
      formatMoney(
        data.total
      )
    );

  const requestMessage =
    preserveLines(
      shortenMessage(
        data.requestMessage
      )
    );

  const chatUrl =
    escapeHtml(
      data.chatUrl
    );

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    BirdShop Service Request
  </title>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    background: #090c09;
    color: #eeeade;
    font-family: Arial, Helvetica, sans-serif;
  "
>
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    role="presentation"
    style="
      width: 100%;
      background: #090c09;
      padding: 42px 16px;
    "
  >
    <tr>
      <td align="center">

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          role="presentation"
          style="
            width: 100%;
            max-width: 640px;
            background: #111611;
            border: 1px solid #293229;
            border-radius: 22px;
            overflow: hidden;
          "
        >

          <!-- HEADER -->

          <tr>
            <td
              style="
                padding: 32px 36px 26px;
                border-bottom: 1px solid #293229;
              "
            >
              <div
                style="
                  margin-bottom: 10px;
                  color: #889983;
                  font-size: 10px;
                  letter-spacing: 4px;
                "
              >
                BIRDSHOP / SERVICE
              </div>

              <div
                style="
                  color: #f1eee2;
                  font-size: 28px;
                  font-weight: 700;
                  letter-spacing: 4px;
                "
              >
                BIRDSHOP
              </div>
            </td>
          </tr>

          <!-- CONTENT -->

          <tr>
            <td
              style="
                padding: 40px 36px 38px;
              "
            >

              <div
                style="
                  margin-bottom: 12px;
                  color: #879b80;
                  font-size: 10px;
                  letter-spacing: 3px;
                "
              >
                REQUEST RECEIVED
              </div>

              <h1
                style="
                  margin: 0 0 16px;
                  color: #f1eee2;
                  font-size: 31px;
                  font-weight: 500;
                  line-height: 1.2;
                "
              >
                Your service request is ready.
              </h1>

              <p
                style="
                  margin: 0 0 30px;
                  color: #aab2a6;
                  font-size: 15px;
                  line-height: 1.8;
                "
              >
                Hi ${customerName}, your BirdShop service
                request has been created successfully.
                Keep your reference below and continue
                securely inside your private service chat.
              </p>

              <!-- REFERENCE -->

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                role="presentation"
                style="
                  margin-bottom: 30px;
                  background: #0b100c;
                  border: 1px solid #293229;
                  border-radius: 14px;
                "
              >
                <tr>
                  <td
                    style="
                      padding: 24px;
                    "
                  >
                    <div
                      style="
                        margin-bottom: 8px;
                        color: #738071;
                        font-size: 9px;
                        letter-spacing: 3px;
                      "
                    >
                      SERVICE REFERENCE
                    </div>

                    <div
                      style="
                        color: #f1eee2;
                        font-size: 25px;
                        font-weight: 700;
                        letter-spacing: 2px;
                      "
                    >
                      ${reference}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- SERVICE INFO -->

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                role="presentation"
                style="
                  margin-bottom: 30px;
                "
              >
                <tr>

                  <td
                    width="50%"
                    valign="top"
                    style="
                      padding: 0 12px 22px 0;
                    "
                  >
                    <div
                      style="
                        color: #738071;
                        font-size: 9px;
                        letter-spacing: 2px;
                      "
                    >
                      SERVICE
                    </div>

                    <div
                      style="
                        margin-top: 7px;
                        color: #eeeade;
                        font-size: 15px;
                        line-height: 1.5;
                      "
                    >
                      ${serviceName}
                    </div>
                  </td>

                  <td
                    width="50%"
                    valign="top"
                    style="
                      padding: 0 0 22px 12px;
                    "
                  >
                    <div
                      style="
                        color: #738071;
                        font-size: 9px;
                        letter-spacing: 2px;
                      "
                    >
                      PACKAGE
                    </div>

                    <div
                      style="
                        margin-top: 7px;
                        color: #eeeade;
                        font-size: 15px;
                        line-height: 1.5;
                      "
                    >
                      ${packageName}
                    </div>
                  </td>

                </tr>

                <tr>

                  <td
                    colspan="2"
                    valign="top"
                  >
                    <div
                      style="
                        color: #738071;
                        font-size: 9px;
                        letter-spacing: 2px;
                      "
                    >
                      REQUESTED PRICE
                    </div>

                    <div
                      style="
                        margin-top: 7px;
                        color: #eeeade;
                        font-size: 15px;
                      "
                    >
                      ${price}
                    </div>
                  </td>

                </tr>
              </table>

              <!-- REQUEST -->

              <div
                style="
                  margin-bottom: 34px;
                  padding: 4px 0 4px 18px;
                  border-left: 2px solid #74846f;
                "
              >
                <div
                  style="
                    margin-bottom: 10px;
                    color: #738071;
                    font-size: 9px;
                    letter-spacing: 2px;
                  "
                >
                  YOUR REQUEST
                </div>

                <div
                  style="
                    color: #b8c0b4;
                    font-size: 14px;
                    line-height: 1.8;
                  "
                >
                  ${requestMessage}
                </div>
              </div>

              <!-- BUTTON -->

              <table
                cellpadding="0"
                cellspacing="0"
                border="0"
                role="presentation"
              >
                <tr>
                  <td
                    style="
                      background: #e6e0cf;
                      border-radius: 9px;
                    "
                  >
                    <a
                      href="${chatUrl}"
                      style="
                        display: inline-block;
                        padding: 16px 24px;
                        color: #111611;
                        font-size: 11px;
                        font-weight: 700;
                        letter-spacing: 2px;
                        text-decoration: none;
                      "
                    >
                      OPEN PRIVATE SERVICE CHAT →
                    </a>
                  </td>
                </tr>
              </table>

              <p
                style="
                  margin: 30px 0 0;
                  color: #677065;
                  font-size: 11px;
                  line-height: 1.8;
                "
              >
                Final scope, timing, and payment may be
                confirmed with BirdShop before work begins.
              </p>

            </td>
          </tr>

          <!-- FOOTER -->

          <tr>
            <td
              style="
                padding: 24px 36px;
                border-top: 1px solid #293229;
                color: #626b60;
                font-size: 10px;
                line-height: 1.7;
                letter-spacing: 1px;
              "
            >
              BIRDSHOP · DIGITAL PRODUCTS & SERVICES
              <br />
              Reference ${reference}
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/* =========================================================
   ADMIN EMAIL
========================================================= */

export function serviceCreatedAdminEmail(
  data:
    ServiceCreatedAdminEmailData
) {
  const reference =
    escapeHtml(
      data.reference
    );

  const customerName =
    escapeHtml(
      data.customerName ||
        "Customer"
    );

  const customerEmail =
    escapeHtml(
      data.customerEmail ||
        "No email supplied"
    );

  const customerContact =
    escapeHtml(
      data.customerContact ||
        "No contact supplied"
    );

  const serviceName =
    escapeHtml(
      data.serviceName ||
        "Unknown Service"
    );

  const packageName =
    escapeHtml(
      data.packageName ||
        "Custom Package"
    );

  const price =
    escapeHtml(
      formatMoney(
        data.total
      )
    );

  const requestMessage =
    preserveLines(
      shortenMessage(
        data.requestMessage
      )
    );

  const adminUrl =
    escapeHtml(
      data.adminUrl
    );

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    New BirdShop Service Request
  </title>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    background: #090c09;
    color: #eeeade;
    font-family: Arial, Helvetica, sans-serif;
  "
>
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    role="presentation"
    style="
      width: 100%;
      background: #090c09;
      padding: 42px 16px;
    "
  >
    <tr>
      <td align="center">

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          role="presentation"
          style="
            width: 100%;
            max-width: 640px;
            background: #111611;
            border: 1px solid #293229;
            border-radius: 22px;
            overflow: hidden;
          "
        >

          <tr>
            <td
              style="
                padding: 32px 36px 24px;
                border-bottom: 1px solid #293229;
              "
            >
              <div
                style="
                  margin-bottom: 10px;
                  color: #889983;
                  font-size: 10px;
                  letter-spacing: 4px;
                "
              >
                BIRDSHOP / ADMIN
              </div>

              <div
                style="
                  color: #f1eee2;
                  font-size: 27px;
                  font-weight: 700;
                  letter-spacing: 4px;
                "
              >
                NEW SERVICE REQUEST
              </div>
            </td>
          </tr>

          <tr>
            <td
              style="
                padding: 38px 36px;
              "
            >

              <div
                style="
                  margin-bottom: 7px;
                  color: #738071;
                  font-size: 9px;
                  letter-spacing: 3px;
                "
              >
                REFERENCE
              </div>

              <div
                style="
                  margin-bottom: 30px;
                  color: #f1eee2;
                  font-size: 24px;
                  font-weight: 700;
                "
              >
                ${reference}
              </div>

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                role="presentation"
              >
                <tr>
                  <td
                    style="
                      padding-bottom: 14px;
                      color: #7d8979;
                      width: 150px;
                    "
                  >
                    Customer
                  </td>

                  <td
                    style="
                      padding-bottom: 14px;
                      color: #eeeade;
                    "
                  >
                    ${customerName}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding-bottom: 14px;
                      color: #7d8979;
                    "
                  >
                    Email
                  </td>

                  <td
                    style="
                      padding-bottom: 14px;
                      color: #eeeade;
                    "
                  >
                    ${customerEmail}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding-bottom: 14px;
                      color: #7d8979;
                    "
                  >
                    Contact
                  </td>

                  <td
                    style="
                      padding-bottom: 14px;
                      color: #eeeade;
                    "
                  >
                    ${customerContact}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding-bottom: 14px;
                      color: #7d8979;
                    "
                  >
                    Service
                  </td>

                  <td
                    style="
                      padding-bottom: 14px;
                      color: #eeeade;
                    "
                  >
                    ${serviceName}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding-bottom: 14px;
                      color: #7d8979;
                    "
                  >
                    Package
                  </td>

                  <td
                    style="
                      padding-bottom: 14px;
                      color: #eeeade;
                    "
                  >
                    ${packageName}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding-bottom: 14px;
                      color: #7d8979;
                    "
                  >
                    Requested Price
                  </td>

                  <td
                    style="
                      padding-bottom: 14px;
                      color: #eeeade;
                    "
                  >
                    ${price}
                  </td>
                </tr>
              </table>

              <div
                style="
                  margin: 26px 0 32px;
                  padding: 20px;
                  background: #0b100c;
                  border: 1px solid #293229;
                  border-left: 2px solid #74846f;
                  border-radius: 10px;
                "
              >
                <div
                  style="
                    margin-bottom: 10px;
                    color: #738071;
                    font-size: 9px;
                    letter-spacing: 2px;
                  "
                >
                  CUSTOMER REQUEST
                </div>

                <div
                  style="
                    color: #b8c0b4;
                    font-size: 14px;
                    line-height: 1.8;
                  "
                >
                  ${requestMessage}
                </div>
              </div>

              <table
                cellpadding="0"
                cellspacing="0"
                border="0"
                role="presentation"
              >
                <tr>
                  <td
                    style="
                      background: #e6e0cf;
                      border-radius: 9px;
                    "
                  >
                    <a
                      href="${adminUrl}"
                      style="
                        display: inline-block;
                        padding: 16px 24px;
                        color: #111611;
                        font-size: 11px;
                        font-weight: 700;
                        letter-spacing: 2px;
                        text-decoration: none;
                      "
                    >
                      OPEN ADMIN CHAT →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td
              style="
                padding: 24px 36px;
                border-top: 1px solid #293229;
                color: #626b60;
                font-size: 10px;
                line-height: 1.7;
              "
            >
              BIRDSHOP ADMINISTRATION
              <br />
              Service ${reference}
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
}