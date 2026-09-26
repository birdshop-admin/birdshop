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
  createAdminClient,
} from "@/lib/supabase/admin";

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

type SupabaseWebhookPayload = {
  type?:
    string;

  table?:
    string;

  schema?:
    string;

  record?: {
    id?:
      string;
  } | null;
};

type Conversation = {
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
  if (
    !value
  ) {
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
      "BirdShop conversation webhook is missing required environment configuration."
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
     AUTHENTICATE WEBHOOK
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
      },
      {
        status:
          401,
      }
    );
  }

  /* =======================================================
     BODY
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
     ONLY CONVERSATION INSERTS
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

  const conversationId =
    String(
      payload.record
        ?.id ??
      ""
    ).trim();

  if (
    !conversationId
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Conversation ID missing.",
      },
      {
        status:
          400,
      }
    );
  }

  /* =======================================================
     LOAD CONVERSATION
  ======================================================= */

  const supabase =
    createAdminClient();

  const {
    data,
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
        public_token,
        reference,
        conversation_type,
        customer_name,
        customer_email,
        customer_contact,
        subject,
        request_message,
        service_name,
        package_name,
        product_name,
        product_platform,
        product_region,
        deleted_at
        `
      )
      .eq(
        "id",
        conversationId
      )
      .maybeSingle();

  if (
    conversationError
  ) {
    console.error(
      "Unable to load BirdShop conversation for email.",
      {
        conversationId,

        error:
          conversationError.message,
      }
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Unable to load conversation.",
      },
      {
        status:
          500,
      }
    );
  }

  if (
    !data
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Conversation not found.",
      },
      {
        status:
          404,
      }
    );
  }

  const conversation =
    data as unknown as
      Conversation;

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

  const chatUrl =
    `${siteUrl}/service-chat?token=${encodeURIComponent(
      conversation.public_token
    )}`;

  const recoveryUrl =
    `${siteUrl}/service-chat`;

  const type =
    normalizeConversationType(
      conversation.conversation_type
    );

  const adminUrl =
    `${siteUrl}/admin/chat?view=active&type=${encodeURIComponent(
      type
    )}&conversation=${encodeURIComponent(
      conversation.id
    )}`;

  /* =======================================================
     EMAIL DATA
  ======================================================= */

  const emailData = {
    reference:
      conversation.reference,

    conversationType:
      type,

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
     SEND

     Idempotency prevents duplicate successful sends if
     Supabase retries the webhook after a partial failure.
  ======================================================= */

  const resend =
    new Resend(
      resendKey
    );

  const jobs:
    Promise<unknown>[] =
    [];

  const customerCanReceive =
    isEmail(
      conversation.customer_email
    );

  if (
    customerCanReceive
  ) {
    jobs.push(
      resend.emails.send(
        {
          from:
            emailFrom,

          to:
            conversation.customer_email!,

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
      )
    );
  }

  jobs.push(
    resend.emails.send(
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
          `birdshop-conversation-admin-${conversation.id}`,
      }
    )
  );

  const results =
    await Promise.allSettled(
      jobs
    );

  const failed =
    results.filter(
      (
        result
      ) =>
        result.status ===
        "rejected"
    );

  if (
    failed.length >
    0
  ) {
    console.error(
      "One or more BirdShop conversation emails failed.",
      {
        conversationId,

        customerAttempted:
          customerCanReceive,

        failureCount:
          failed.length,
      }
    );

    /*
     * Return a failure so Supabase may retry.
     *
     * Resend idempotency prevents already-successful email
     * sends from becoming duplicates on retry.
     */
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "One or more emails failed.",
      },
      {
        status:
          500,
      }
    );
  }

  return NextResponse.json({
    ok:
      true,

    customerEmailSent:
      customerCanReceive,

    adminEmailSent:
      true,
  });
}