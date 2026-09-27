import {
  timingSafeEqual,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  Resend,
} from "resend";

import {
  conversationCreatedAdminEmail,
  conversationCreatedCustomerEmail,
  type ConversationType,
} from "@/lib/email/service-created";

/* =========================================================
   RUNTIME
========================================================= */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ConversationRecord = {
  id?: string | null;

  public_token?:
    | string
    | null;

  reference?:
    | string
    | null;

  conversation_type?:
    | string
    | null;

  customer_name?:
    | string
    | null;

  customer_email?:
    | string
    | null;

  customer_contact?:
    | string
    | null;

  subject?:
    | string
    | null;

  request_message?:
    | string
    | null;

  service_slug?:
    | string
    | null;

  service_name?:
    | string
    | null;

  package_id?:
    | string
    | null;

  package_name?:
    | string
    | null;

  product_slug?:
    | string
    | null;

  product_name?:
    | string
    | null;

  product_platform?:
    | string
    | null;

  product_region?:
    | string
    | null;

  source?:
    | string
    | null;
};

type DatabaseWebhookPayload = {
  type?:
    string;

  table?:
    string;

  schema?:
    string;

  record?:
    ConversationRecord
    | null;

  old_record?:
    Record<
      string,
      unknown
    >
    | null;
};

/* =========================================================
   ENVIRONMENT
========================================================= */

function requireEnvironmentVariable(
  name: string
) {
  const value =
    process.env[name]
      ?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}

/* =========================================================
   SECRET COMPARISON
========================================================= */

function secretsMatch(
  received:
    string,
  expected:
    string
) {
  const receivedBuffer =
    Buffer.from(
      received
    );

  const expectedBuffer =
    Buffer.from(
      expected
    );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

/* =========================================================
   URL
========================================================= */

function normalizeSiteUrl(
  value:
    string
) {
  return value.replace(
    /\/+$/,
    ""
  );
}

/* =========================================================
   CONVERSATION TYPE
========================================================= */

function normalizeConversationType(
  value:
    string | null | undefined
):
  ConversationType | null {

  if (
    value ===
      "service" ||
    value ===
      "product" ||
    value ===
      "general"
  ) {
    return value;
  }

  return null;
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request:
    Request
) {
  try {
    /* =====================================================
       WEBHOOK SECRET
    ===================================================== */

    const expectedSecret =
      requireEnvironmentVariable(
        "BIRDSHOP_WEBHOOK_SECRET"
      );

    const receivedSecret =
      request.headers
        .get(
          "x-birdshop-webhook-secret"
        )
        ?.trim() ??
      "";

    if (
      !receivedSecret ||
      !secretsMatch(
        receivedSecret,
        expectedSecret
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Unauthorized.",
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

    let payload:
      DatabaseWebhookPayload;

    try {
      payload =
        await request.json() as
          DatabaseWebhookPayload;
    } catch {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Invalid webhook payload.",
        },
        {
          status:
            400,
        }
      );
    }

    /* =====================================================
       ONLY ACCEPT:
       INSERT public.service_conversations
    ===================================================== */

    if (
      payload.type !==
        "INSERT" ||
      payload.schema !==
        "public" ||
      payload.table !==
        "service_conversations"
    ) {
      return NextResponse.json(
        {
          ok:
            true,

          ignored:
            true,
        }
      );
    }

    const conversation =
      payload.record;

    if (
      !conversation
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Conversation record missing.",
        },
        {
          status:
            400,
        }
      );
    }

    /* =====================================================
       REQUIRED RECORD FIELDS
    ===================================================== */

    const conversationId =
      String(
        conversation.id ??
        ""
      ).trim();

    const publicToken =
      String(
        conversation
          .public_token ??
        ""
      ).trim();

    const reference =
      String(
        conversation.reference ??
        ""
      ).trim();

    const conversationType =
      normalizeConversationType(
        conversation
          .conversation_type
      );

    if (
      !conversationId ||
      !publicToken ||
      !reference ||
      !conversationType
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Conversation record is incomplete.",
        },
        {
          status:
            400,
        }
      );
    }

    /* =====================================================
       ENVIRONMENT
    ===================================================== */

    const resendApiKey =
      requireEnvironmentVariable(
        "RESEND_API_KEY"
      );

    const emailFrom =
      requireEnvironmentVariable(
        "BIRDSHOP_EMAIL_FROM"
      );

    const adminEmail =
      requireEnvironmentVariable(
        "BIRDSHOP_ADMIN_EMAIL"
      );

    const siteUrl =
      normalizeSiteUrl(
        requireEnvironmentVariable(
          "BIRDSHOP_SITE_URL"
        )
      );

    const resend =
      new Resend(
        resendApiKey
      );

    /* =====================================================
       URLS

       Do not log publicToken.
    ===================================================== */

    const chatUrl =
      `${siteUrl}/service-chat?token=${encodeURIComponent(
        publicToken
      )}`;

    const recoveryUrl =
      `${siteUrl}/service-chat`;

    const adminUrl =
      `${siteUrl}/admin/chat?view=active&conversation=${encodeURIComponent(
        conversationId
      )}`;

    /* =====================================================
       EMAIL DATA
    ===================================================== */

    const emailData = {
      reference,

      conversationType,

      customerName:
        conversation
          .customer_name ??
        null,

      customerEmail:
        conversation
          .customer_email ??
        null,

      customerContact:
        conversation
          .customer_contact ??
        null,

      subject:
        conversation
          .subject ??
        null,

      requestMessage:
        conversation
          .request_message ??
        null,

      serviceName:
        conversation
          .service_name ??
        null,

      packageName:
        conversation
          .package_name ??
        null,

      productName:
        conversation
          .product_name ??
        null,

      productPlatform:
        conversation
          .product_platform ??
        null,

      productRegion:
        conversation
          .product_region ??
        null,

      chatUrl,

      recoveryUrl,
    };

    /* =====================================================
       CUSTOMER EMAIL
    ===================================================== */

    let customerEmailSent =
      false;

    const customerEmail =
      conversation
        .customer_email
        ?.trim() ??
      "";

    if (
      customerEmail
    ) {
      const customerTemplate =
        conversationCreatedCustomerEmail(
          emailData
        );

      const {
        error:
          customerError,
      } =
        await resend.emails.send(
          {
            from:
              emailFrom,

            to:
              customerEmail,

            subject:
              customerTemplate.subject,

            html:
              customerTemplate.html,

            text:
              customerTemplate.text,
          },
          {
            idempotencyKey:
              `birdshop-conversation-customer-${conversationId}`,
          }
        );

      if (
        customerError
      ) {
        console.error(
          "BirdShop customer conversation email failed:",
          customerError.message
        );

        return NextResponse.json(
          {
            ok:
              false,

            error:
              "Customer email delivery failed.",
          },
          {
            status:
              502,
          }
        );
      }

      customerEmailSent =
        true;
    }

    /* =====================================================
       ADMIN EMAIL
    ===================================================== */

    const adminTemplate =
      conversationCreatedAdminEmail({
        ...emailData,

        adminUrl,
      });

    const {
      error:
        adminSendError,
    } =
      await resend.emails.send(
        {
          from:
            emailFrom,

          to:
            adminEmail,

          subject:
            adminTemplate.subject,

          html:
            adminTemplate.html,

          text:
            adminTemplate.text,
        },
        {
          idempotencyKey:
            `birdshop-conversation-admin-${conversationId}`,
        }
      );

    if (
      adminSendError
    ) {
      console.error(
        "BirdShop admin conversation email failed:",
        adminSendError.message
      );

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Admin email delivery failed.",
        },
        {
          status:
            502,
        }
      );
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    return NextResponse.json({
      ok:
        true,

      customerEmailSent,

      adminEmailSent:
        true,
    });
  } catch (
    problem
  ) {
    console.error(
      "BirdShop conversation-created webhook failed:",
      problem instanceof
        Error
        ? problem.message
        : "Unknown error"
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Webhook processing failed.",
      },
      {
        status:
          500,
      }
    );
  }
}