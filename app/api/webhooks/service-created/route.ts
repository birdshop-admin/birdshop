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

export const runtime =
  "nodejs";

/* =========================================================
   TYPES
========================================================= */

type ConversationRecord = {
  id:
    string;

  public_token:
    string;

  reference:
    string;

  conversation_type:
    ConversationType;

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

  request_message:
    | string
    | null;

  service_name:
    | string
    | null;

  package_name:
    | string
    | null;

  product_name:
    | string
    | null;

  product_platform:
    | string
    | null;

  product_region:
    | string
    | null;

  deleted_at:
    | string
    | null;
};

type SupabaseWebhookPayload = {
  type?:
    string;

  table?:
    string;

  schema?:
    string;

  record?:
    ConversationRecord | null;

  old_record?:
    unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function safeSecretEqual(
  left:
    string,
  right:
    string
) {
  const leftBuffer =
    Buffer.from(
      left
    );

  const rightBuffer =
    Buffer.from(
      right
    );

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

function normalizeSiteUrl(
  value:
    string
) {
  return value
    .trim()
    .replace(
      /\/+$/,
      ""
    );
}

function isEmail(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim()
  );
}

function normalizeConversationType(
  value:
    string
):
  ConversationType {

  if (
    value ===
      "product" ||
    value ===
      "general"
  ) {
    return value;
  }

  return "service";
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request:
    Request
) {
  /* =======================================================
     ENVIRONMENT
  ======================================================= */

  const webhookSecret =
    process.env
      .BIRDSHOP_WEBHOOK_SECRET;

  const resendKey =
    process.env
      .RESEND_API_KEY;

  const emailFrom =
    process.env
      .BIRDSHOP_EMAIL_FROM;

  const adminEmail =
    process.env
      .BIRDSHOP_ADMIN_EMAIL;

  const siteUrlRaw =
    process.env
      .BIRDSHOP_SITE_URL;

  if (
    !webhookSecret ||
    !resendKey ||
    !emailFrom ||
    !adminEmail ||
    !siteUrlRaw
  ) {
    console.error(
      "BirdShop conversation webhook is missing required environment variables."
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Webhook configuration is incomplete.",
      },
      {
        status:
          500,
      }
    );
  }

  /* =======================================================
     VERIFY WEBHOOK SECRET
  ======================================================= */

  const suppliedSecret =
    request.headers.get(
      "x-birdshop-webhook-secret"
    );

  if (
    !suppliedSecret ||
    !safeSecretEqual(
      suppliedSecret,
      webhookSecret
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

  /* =======================================================
     READ WEBHOOK
  ======================================================= */

  let payload:
    SupabaseWebhookPayload;

  try {
    payload =
      (
        await request.json()
      ) as
        SupabaseWebhookPayload;
  } catch {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Invalid webhook body.",
      },
      {
        status:
          400,
      }
    );
  }

  /* =======================================================
     ONLY INSERTS FROM SERVICE_CONVERSATIONS
  ======================================================= */

  if (
    payload.type !==
      "INSERT" ||
    payload.schema !==
      "public" ||
    payload.table !==
      "service_conversations"
  ) {
    return NextResponse.json({
      ok:
        true,

      ignored:
        true,
    });
  }

  /* =======================================================
     USE THE INSERTED ROW DIRECTLY

     Supabase Database Webhooks already include the new
     table row in payload.record.

     No second Supabase API request is needed.
  ======================================================= */

  const conversation =
    payload.record;

  if (
    !conversation ||
    !conversation.id ||
    !conversation.reference ||
    !conversation.public_token
  ) {
    console.error(
      "BirdShop webhook received an incomplete conversation record.",
      {
        hasRecord:
          Boolean(
            conversation
          ),

        hasId:
          Boolean(
            conversation
              ?.id
          ),

        hasReference:
          Boolean(
            conversation
              ?.reference
          ),

        hasToken:
          Boolean(
            conversation
              ?.public_token
          ),
      }
    );

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

  if (
    conversation.deleted_at
  ) {
    return NextResponse.json({
      ok:
        true,

      ignored:
        true,
    });
  }

  /* =======================================================
     URLS
  ======================================================= */

  const siteUrl =
    normalizeSiteUrl(
      siteUrlRaw
    );

  const conversationType =
    normalizeConversationType(
      conversation.conversation_type
    );

  const chatUrl =
    `${siteUrl}/service-chat?token=${encodeURIComponent(
      conversation.public_token
    )}`;

  const recoveryUrl =
    `${siteUrl}/service-chat`;

  const adminUrl =
    `${siteUrl}/admin/chat?view=active&type=${encodeURIComponent(
      conversationType
    )}&conversation=${encodeURIComponent(
      conversation.id
    )}`;

  /* =======================================================
     EMAIL DATA
  ======================================================= */

  const emailData = {
    reference:
      conversation.reference,

    conversationType,

    customerName:
      conversation.customer_name,

    customerEmail:
      conversation.customer_email,

    customerContact:
      conversation.customer_contact,

    subject:
      conversation.subject,

    requestMessage:
      conversation.request_message,

    serviceName:
      conversation.service_name,

    packageName:
      conversation.package_name,

    productName:
      conversation.product_name,

    productPlatform:
      conversation.product_platform,

    productRegion:
      conversation.product_region,

    chatUrl,

    recoveryUrl,
  };

  const customerTemplate =
    conversationCreatedCustomerEmail(
      emailData
    );

  const adminTemplate =
    conversationCreatedAdminEmail({
      ...emailData,

      adminUrl,
    });

  /* =======================================================
     RESEND
  ======================================================= */

  const resend =
    new Resend(
      resendKey
    );

  /* =======================================================
     CUSTOMER EMAIL
  ======================================================= */

  let customerEmailSent =
    false;

  if (
    isEmail(
      conversation.customer_email
    )
  ) {
    const {
      data:
        customerSend,

      error:
        customerError,
    } =
      await resend.emails.send(
        {
          from:
            emailFrom,

          to: [
            conversation.customer_email!,
          ],

          subject:
            customerTemplate.subject,

          html:
            customerTemplate.html,

          text:
            customerTemplate.text,
        },
        {
          idempotencyKey:
            `birdshop-conversation-customer-${conversation.id}`,
        }
      );

    if (
      customerError
    ) {
      console.error(
        "BirdShop customer email failed.",
        {
          conversationId:
            conversation.id,

          error:
            customerError.message,
        }
      );

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Customer email failed.",

          resendError:
            customerError.message,
        },
        {
          status:
            502,
        }
      );
    }

    customerEmailSent =
      Boolean(
        customerSend?.id
      );
  }

  /* =======================================================
     ADMIN EMAIL
  ======================================================= */

  const {
    data:
      adminSend,

    error:
      adminSendError,
  } =
    await resend.emails.send(
      {
        from:
          emailFrom,

        to: [
          adminEmail,
        ],

        subject:
          adminTemplate.subject,

        html:
          adminTemplate.html,

        text:
          adminTemplate.text,
      },
      {
        idempotencyKey:
          `birdshop-conversation-admin-${conversation.id}`,
      }
    );

  if (
    adminSendError
  ) {
    console.error(
      "BirdShop admin email failed.",
      {
        conversationId:
          conversation.id,

        error:
          adminSendError.message,
      }
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Admin email failed.",

        resendError:
          adminSendError.message,
      },
      {
        status:
          502,
      }
    );
  }

  /* =======================================================
     SUCCESS
  ======================================================= */

  return NextResponse.json({
    ok:
      true,

    customerEmailSent,

    adminEmailSent:
      Boolean(
        adminSend?.id
      ),
  });
}