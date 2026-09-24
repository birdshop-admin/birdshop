import {
  NextResponse,
} from "next/server";

import {
  Resend,
} from "resend";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  serviceCreatedAdminEmail,
  serviceCreatedCustomerEmail,
} from "@/lib/email/service-created";

/* =========================================================
   RUNTIME
========================================================= */

export const runtime =
  "nodejs";

/* =========================================================
   TYPES
========================================================= */

type ServiceConversationRecord = {
  id: string;

  order_id: string;

  public_token: string;

  status:
    string;

  created_at:
    string;
};

type DatabaseWebhookPayload = {
  type:
    | "INSERT"
    | "UPDATE"
    | "DELETE";

  table:
    string;

  schema:
    string;

  record:
    ServiceConversationRecord | null;

  old_record:
    ServiceConversationRecord | null;
};

type ServiceOrder = {
  id: string;

  reference:
    string;

  customer_name:
    string;

  customer_email:
    string | null;

  customer_contact:
    string | null;

  order_type:
    string;

  service_name:
    string | null;

  package_name:
    string | null;

  total:
    number | string | null;

  payment_status:
    string;

  service_status:
    string | null;

  service_request_message:
    string | null;

  created_at:
    string;
};

/* =========================================================
   HELPERS
========================================================= */

function isEmail(
  value:
    string | null
) {
  if (!value) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim()
  );
}

function getRequiredEnv(
  key: string
) {
  const value =
    process.env[
      key
    ]?.trim();

  if (!value) {
    throw new Error(
      `${key} is not configured.`
    );
  }

  return value;
}

/* =========================================================
   SERVICE CREATED WEBHOOK
========================================================= */

export async function POST(
  request: Request
) {
  try {
    /* =====================================================
       VERIFY WEBHOOK SECRET
    ===================================================== */

    const expectedSecret =
      getRequiredEnv(
        "BIRDSHOP_WEBHOOK_SECRET"
      );

    const receivedSecret =
      request.headers.get(
        "x-birdshop-webhook-secret"
      );

    if (
      !receivedSecret ||
      receivedSecret !==
        expectedSecret
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized webhook.",
        },
        {
          status:
            401,
        }
      );
    }

    /* =====================================================
       PAYLOAD
    ===================================================== */

    const payload =
      await request.json() as DatabaseWebhookPayload;

    if (
      payload.type !==
        "INSERT" ||
      payload.schema !==
        "public" ||
      payload.table !==
        "service_conversations" ||
      !payload.record
    ) {
      return NextResponse.json({
        ok:
          true,

        ignored:
          true,
      });
    }

    const conversation =
      payload.record;

    /* =====================================================
       CONFIG
    ===================================================== */

    const resendApiKey =
      getRequiredEnv(
        "RESEND_API_KEY"
      );

    const fromEmail =
      getRequiredEnv(
        "BIRDSHOP_EMAIL_FROM"
      );

    const adminEmail =
      getRequiredEnv(
        "BIRDSHOP_ADMIN_EMAIL"
      );

    const siteUrl =
      getRequiredEnv(
        "BIRDSHOP_SITE_URL"
      ).replace(
        /\/+$/,
        ""
      );

    const resend =
      new Resend(
        resendApiKey
      );

    const supabase =
      createAdminClient();

    /* =====================================================
       LOAD SERVICE ORDER

       We intentionally load this from the database instead
       of trusting customer/browser supplied webhook data.
    ===================================================== */

    const {
      data:
        orderData,

      error:
        orderError,
    } =
      await supabase
        .from(
          "orders"
        )
        .select(
          `
            id,
            reference,
            customer_name,
            customer_email,
            customer_contact,
            order_type,
            service_name,
            package_name,
            total,
            payment_status,
            service_status,
            service_request_message,
            created_at
          `
        )
        .eq(
          "id",
          conversation.order_id
        )
        .eq(
          "order_type",
          "service"
        )
        .single();

    if (
      orderError ||
      !orderData
    ) {
      console.error(
        "Unable to load service order:",
        orderError
      );

      return NextResponse.json(
        {
          error:
            "Service order could not be loaded.",
        },
        {
          status:
            500,
        }
      );
    }

    const order =
      orderData as unknown as ServiceOrder;

    /* =====================================================
       URLS
    ===================================================== */

    const customerChatUrl =
      `${siteUrl}/service-chat?token=${encodeURIComponent(
        conversation.public_token
      )}`;

    const adminChatUrl =
      `${siteUrl}/admin/chat?conversation=${encodeURIComponent(
        conversation.id
      )}`;

    /* =====================================================
       SHARED EMAIL DATA
    ===================================================== */

    const emailData = {
      reference:
        order.reference,

      customerName:
        order.customer_name,

      serviceName:
        order.service_name,

      packageName:
        order.package_name,

      total:
        order.total,

      requestMessage:
        order.service_request_message,

      chatUrl:
        customerChatUrl,
    };

    /* =====================================================
       CUSTOMER EMAIL

       If the service request only used Discord and did not
       contain an email address, we simply skip this email.
    ===================================================== */

    let customerEmailSent =
      false;

    let customerEmailId:
      | string
      | null =
      null;

    const customerEmail =
      order.customer_email
        ?.trim() ??
      "";

    if (
      isEmail(
        customerEmail
      )
    ) {
      const {
        data,
        error,
      } =
        await resend
          .emails
          .send(
            {
              from:
                fromEmail,

              to:
                customerEmail,

              subject:
                `Service request ${order.reference} received — BirdShop`,

              html:
                serviceCreatedCustomerEmail(
                  emailData
                ),
            },
            {
              idempotencyKey:
                `service-created-customer/${conversation.id}`,
            }
          );

      if (
        error
      ) {
        console.error(
          "Customer email failed:",
          error
        );
      } else {
        customerEmailSent =
          true;

        customerEmailId =
          data?.id ??
          null;
      }
    }

    /* =====================================================
       ADMIN EMAIL
    ===================================================== */

    const {
      data:
        adminEmailData,

      error:
        adminEmailError,
    } =
      await resend
        .emails
        .send(
          {
            from:
              fromEmail,

            to:
              adminEmail,

            subject:
              `New BirdShop service request — ${order.reference}`,

            html:
              serviceCreatedAdminEmail(
                {
                  ...emailData,

                  adminUrl:
                    adminChatUrl,

                  customerContact:
                    order.customer_contact,

                  customerEmail:
                    order.customer_email,
                }
              ),
          },
          {
            idempotencyKey:
              `service-created-admin/${conversation.id}`,
          }
        );

    if (
      adminEmailError
    ) {
      console.error(
        "Admin email failed:",
        adminEmailError
      );
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      ok:
        true,

      reference:
        order.reference,

      customerEmail: {
        attempted:
          isEmail(
            customerEmail
          ),

        sent:
          customerEmailSent,

        id:
          customerEmailId,
      },

      adminEmail: {
        sent:
          !adminEmailError,

        id:
          adminEmailData
            ?.id ??
          null,
      },
    });
  } catch (
    problem
  ) {
    console.error(
      "BirdShop service email webhook:",
      problem
    );

    return NextResponse.json(
      {
        error:
          problem instanceof
            Error
            ? problem.message
            : "Unable to process BirdShop service email.",
      },
      {
        status:
          500,
      }
    );
  }
}