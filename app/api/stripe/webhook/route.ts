import {
  NextResponse,
} from "next/server";

import type Stripe from "stripe";

import {
  Resend,
} from "resend";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getStripe,
} from "@/lib/stripe";

import {
  paymentConfirmedAdminEmail,
  paymentConfirmedCustomerEmail,
} from "@/lib/email/payment-confirmed";

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

type PaymentRequestEmailRow = {
  id: string;

  conversation_id:
    string;

  order_id:
    | string
    | null;

  amount:
    | number
    | string;

  currency:
    string;

  title:
    string;

  paid_at:
    | string
    | null;

  customer_receipt_sent_at:
    | string
    | null;

  customer_receipt_resend_id:
    | string
    | null;

  admin_payment_notification_sent_at:
    | string
    | null;

  admin_payment_resend_id:
    | string
    | null;
};

type ConversationEmailRow = {
  id: string;

  public_token:
    string;

  reference:
    string;

  customer_name:
    | string
    | null;

  customer_email:
    | string
    | null;

  service_name:
    | string
    | null;

  package_name:
    | string
    | null;
};

type OrderEmailRow = {
  id: string;

  reference:
    string;

  customer_name:
    string;

  customer_email:
    string;

  service_name:
    | string
    | null;

  package_name:
    | string
    | null;

  total:
    | number
    | string;

  currency:
    string;

  payment_status:
    string;

  paid_at:
    | string
    | null;
};

/* =========================================================
   ENVIRONMENT
========================================================= */

function requireEnvironmentVariable(
  name:
    string
) {
  const value =
    process.env[
      name
    ]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}

function requireWebhookSecret() {
  return requireEnvironmentVariable(
    "STRIPE_WEBHOOK_SECRET"
  );
}

function requireSiteUrl() {
  return requireEnvironmentVariable(
    "BIRDSHOP_SITE_URL"
  ).replace(
    /\/+$/,
    ""
  );
}

/* =========================================================
   HELPERS
========================================================= */

function objectId(
  value:
    | string
    | {
        id: string;
      }
    | null
    | undefined
) {
  if (!value) {
    return null;
  }

  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  return value.id;
}

function isUuid(
  value:
    string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function validEmail(
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

/* =========================================================
   PAYMENT CONFIRMATION EMAILS
========================================================= */

async function sendPaymentConfirmationEmails({
  paymentRequestId,
  orderId,
  conversationId,
  stripeSessionId,
  stripeCustomerEmail,
}: {
  paymentRequestId:
    string;

  orderId:
    string;

  conversationId:
    string;

  stripeSessionId:
    string;

  stripeCustomerEmail:
    | string
    | null;
}) {
  const supabase =
    createAdminClient();

  const {
    data:
      paymentRaw,

    error:
      paymentError,
  } =
    await supabase
      .from(
        "service_payment_requests"
      )
      .select(
        [
          "id",
          "conversation_id",
          "order_id",
          "amount",
          "currency",
          "title",
          "paid_at",
          "customer_receipt_sent_at",
          "customer_receipt_resend_id",
          "admin_payment_notification_sent_at",
          "admin_payment_resend_id",
        ].join(",")
      )
      .eq(
        "id",
        paymentRequestId
      )
      .maybeSingle();

  if (
    paymentError
  ) {
    throw new Error(
      `Unable to load payment email state: ${paymentError.message}`
    );
  }

  const payment =
    paymentRaw as
      PaymentRequestEmailRow | null;

  if (
    !payment
  ) {
    throw new Error(
      "Payment request could not be loaded for email delivery."
    );
  }

  if (
    payment.conversation_id !==
      conversationId ||
    payment.order_id !==
      orderId
  ) {
    throw new Error(
      "Payment email records do not match the finalized BirdShop order."
    );
  }

  const {
    data:
      conversationRaw,

    error:
      conversationError,
  } =
    await supabase
      .from(
        "service_conversations"
      )
      .select(
        [
          "id",
          "public_token",
          "reference",
          "customer_name",
          "customer_email",
          "service_name",
          "package_name",
        ].join(",")
      )
      .eq(
        "id",
        conversationId
      )
      .maybeSingle();

  if (
    conversationError
  ) {
    throw new Error(
      `Unable to load payment conversation: ${conversationError.message}`
    );
  }

  const conversation =
    conversationRaw as
      ConversationEmailRow | null;

  if (
    !conversation
  ) {
    throw new Error(
      "Payment conversation could not be loaded."
    );
  }

  const {
    data:
      orderRaw,

    error:
      orderError,
  } =
    await supabase
      .from(
        "orders"
      )
      .select(
        [
          "id",
          "reference",
          "customer_name",
          "customer_email",
          "service_name",
          "package_name",
          "total",
          "currency",
          "payment_status",
          "paid_at",
        ].join(",")
      )
      .eq(
        "id",
        orderId
      )
      .maybeSingle();

  if (
    orderError
  ) {
    throw new Error(
      `Unable to load payment order: ${orderError.message}`
    );
  }

  const order =
    orderRaw as
      OrderEmailRow | null;

  if (
    !order
  ) {
    throw new Error(
      "Payment order could not be loaded."
    );
  }

  if (
    order.payment_status !==
    "paid"
  ) {
    throw new Error(
      "BirdShop refused to send a receipt for an unpaid order."
    );
  }

  const customerEmail =
    conversation
      .customer_email
      ?.trim() ||
    order
      .customer_email
      ?.trim() ||
    stripeCustomerEmail
      ?.trim() ||
    "";

  if (
    !validEmail(
      customerEmail
    )
  ) {
    throw new Error(
      "BirdShop could not determine a valid customer email for the payment receipt."
    );
  }

  const siteUrl =
    requireSiteUrl();

  const chatUrl =
    `${siteUrl}/service-chat?token=${encodeURIComponent(
      conversation.public_token
    )}`;

  const adminUrl =
    `${siteUrl}/admin/chat?view=active&conversation=${encodeURIComponent(
      conversation.id
    )}`;

  const reference =
    conversation.reference ||
    order.reference;

  const serviceName =
    conversation.service_name ||
    order.service_name ||
    payment.title ||
    "BirdShop Service";

  const packageName =
    conversation.package_name ||
    order.package_name ||
    "Custom Quote";

  const amount =
    Number(
      order.total ??
      payment.amount
    );

  if (
    !Number.isFinite(
      amount
    )
  ) {
    throw new Error(
      "BirdShop payment receipt has an invalid amount."
    );
  }

  const currency =
    String(
      order.currency ||
      payment.currency ||
      "USD"
    )
      .trim()
      .toUpperCase();

  const paidAt =
    order.paid_at ||
    payment.paid_at ||
    new Date()
      .toISOString();

  const customerName =
    conversation.customer_name ||
    order.customer_name ||
    "Customer";

  const resend =
    new Resend(
      requireEnvironmentVariable(
        "RESEND_API_KEY"
      )
    );

  const emailFrom =
    requireEnvironmentVariable(
      "BIRDSHOP_EMAIL_FROM"
    );

  const adminEmail =
    requireEnvironmentVariable(
      "BIRDSHOP_ADMIN_EMAIL"
    );

  /* =======================================================
     CUSTOMER RECEIPT
  ======================================================= */

  if (
    !payment
      .customer_receipt_sent_at
  ) {
    const template =
      paymentConfirmedCustomerEmail({
        reference,

        orderReference:
          order.reference,

        customerName,

        customerEmail,

        serviceName,

        packageName,

        amount,

        currency,

        paidAt,

        chatUrl,
      });

    const {
      data:
        customerSend,

      error:
        customerSendError,
    } =
      await resend
        .emails
        .send(
          {
            from:
              emailFrom,

            to:
              customerEmail,

            subject:
              template.subject,

            html:
              template.html,

            text:
              template.text,
          },
          {
            idempotencyKey:
              `birdshop-payment-customer-${paymentRequestId}`,
          }
        );

    if (
      customerSendError
    ) {
      throw new Error(
        `Customer payment receipt failed: ${customerSendError.message}`
      );
    }

    const {
      error:
        customerSaveError,
    } =
      await supabase
        .from(
          "service_payment_requests"
        )
        .update({
          customer_receipt_sent_at:
            new Date()
              .toISOString(),

          customer_receipt_resend_id:
            customerSend
              ?.id ??
            null,
        })
        .eq(
          "id",
          paymentRequestId
        )
        .is(
          "customer_receipt_sent_at",
          null
        );

    if (
      customerSaveError
    ) {
      throw new Error(
        `Customer receipt state could not be saved: ${customerSaveError.message}`
      );
    }
  }

  /* =======================================================
     ADMIN PAYMENT NOTIFICATION
  ======================================================= */

  if (
    !payment
      .admin_payment_notification_sent_at
  ) {
    const template =
      paymentConfirmedAdminEmail({
        reference,

        orderReference:
          order.reference,

        customerName,

        customerEmail,

        serviceName,

        packageName,

        amount,

        currency,

        paidAt,

        chatUrl,

        adminUrl,

        paymentRequestId,

        orderId,

        stripeSessionId,
      });

    const {
      data:
        adminSend,

      error:
        adminSendError,
    } =
      await resend
        .emails
        .send(
          {
            from:
              emailFrom,

            to:
              adminEmail,

            subject:
              template.subject,

            html:
              template.html,

            text:
              template.text,
          },
          {
            idempotencyKey:
              `birdshop-payment-admin-${paymentRequestId}`,
          }
        );

    if (
      adminSendError
    ) {
      throw new Error(
        `Admin payment notification failed: ${adminSendError.message}`
      );
    }

    const {
      error:
        adminSaveError,
    } =
      await supabase
        .from(
          "service_payment_requests"
        )
        .update({
          admin_payment_notification_sent_at:
            new Date()
              .toISOString(),

          admin_payment_resend_id:
            adminSend
              ?.id ??
            null,
        })
        .eq(
          "id",
          paymentRequestId
        )
        .is(
          "admin_payment_notification_sent_at",
          null
        );

    if (
      adminSaveError
    ) {
      throw new Error(
        `Admin payment email state could not be saved: ${adminSaveError.message}`
      );
    }
  }
}

/* =========================================================
   FINALIZE PAID CHECKOUT
========================================================= */

async function finalizePaidCheckout(
  session:
    Stripe.Checkout.Session
) {
  if (
    session.mode !==
    "payment"
  ) {
    return;
  }

  if (
    session.payment_status !==
    "paid"
  ) {
    return;
  }

  const paymentRequestId =
    session.metadata
      ?.birdshop_payment_request_id
      ?.trim() ||
    session
      .client_reference_id
      ?.trim() ||
    "";

  const conversationId =
    session.metadata
      ?.birdshop_conversation_id
      ?.trim() ||
    "";

  if (
    !paymentRequestId ||
    !isUuid(
      paymentRequestId
    )
  ) {
    throw new Error(
      "Stripe session is missing a valid BirdShop payment request ID."
    );
  }

  if (
    !conversationId ||
    !isUuid(
      conversationId
    )
  ) {
    throw new Error(
      "Stripe session is missing a valid BirdShop conversation ID."
    );
  }

  if (
    session.amount_total ===
    null
  ) {
    throw new Error(
      "Stripe session is missing amount_total."
    );
  }

  if (
    !session.currency
  ) {
    throw new Error(
      "Stripe session is missing currency."
    );
  }

  const paymentIntentId =
    objectId(
      session.payment_intent
    );

  const stripeCustomerId =
    objectId(
      session.customer
    );

  const customerEmail =
    session
      .customer_details
      ?.email ??
    session.customer_email ??
    null;

  const supabase =
    createAdminClient();

  const {
    data:
      orderIdRaw,

    error,
  } =
    await supabase.rpc(
      "birdshop_finalize_service_payment",
      {
        p_payment_request_id:
          paymentRequestId,

        p_checkout_session_id:
          session.id,

        p_payment_intent_id:
          paymentIntentId,

        p_stripe_customer_id:
          stripeCustomerId,

        p_amount_total:
          session.amount_total,

        p_currency:
          session.currency,

        p_customer_email:
          customerEmail,
      }
    );

  if (
    error
  ) {
    console.error(
      "BirdShop payment finalization failed:",
      {
        event:
          "stripe_payment_finalize",

        paymentRequestId,

        sessionId:
          session.id,

        message:
          error.message,
      }
    );

    throw new Error(
      `BirdShop payment finalization failed: ${error.message}`
    );
  }

  const orderId =
    typeof orderIdRaw ===
      "string"
      ? orderIdRaw
      : String(
          orderIdRaw ??
          ""
        );

  if (
    !isUuid(
      orderId
    )
  ) {
    throw new Error(
      "BirdShop payment finalization did not return a valid order ID."
    );
  }

  console.info(
    "BirdShop Stripe payment finalized:",
    {
      paymentRequestId,

      orderId,

      sessionId:
        session.id,
    }
  );

  await sendPaymentConfirmationEmails({
    paymentRequestId,

    orderId,

    conversationId,

    stripeSessionId:
      session.id,

    stripeCustomerEmail:
      customerEmail,
  });

  console.info(
    "BirdShop payment notifications processed:",
    {
      paymentRequestId,

      orderId,
    }
  );
}

/* =========================================================
   SUCCESSFUL REFUND
========================================================= */

async function synchronizeRefundedCharge(
  charge:
    Stripe.Charge
) {
  const paymentIntentId =
    objectId(
      charge.payment_intent
    );

  if (
    !paymentIntentId
  ) {
    console.info(
      "BirdShop ignored refund without PaymentIntent:",
      {
        chargeId:
          charge.id,
      }
    );

    return;
  }

  const supabase =
    createAdminClient();

  const {
    data:
      orderId,

    error,
  } =
    await supabase.rpc(
      "birdshop_sync_service_refund",
      {
        p_payment_intent_id:
          paymentIntentId,

        p_charge_id:
          charge.id,

        p_amount_refunded:
          charge.amount_refunded,

        p_currency:
          charge.currency,

        p_is_fully_refunded:
          charge.refunded,
      }
    );

  if (
    error
  ) {
    throw new Error(
      `BirdShop refund synchronization failed: ${error.message}`
    );
  }

  if (
    !orderId
  ) {
    console.info(
      "Stripe refund did not belong to a BirdShop service order:",
      {
        paymentIntentId,

        chargeId:
          charge.id,
      }
    );

    return;
  }

  console.info(
    "BirdShop Stripe refund synchronized:",
    {
      orderId,

      paymentIntentId,

      chargeId:
        charge.id,

      amountRefunded:
        charge.amount_refunded,

      fullRefund:
        charge.refunded,
    }
  );
}

/* =========================================================
   FAILED REFUND
========================================================= */

async function recordFailedRefund(
  refund:
    Stripe.Refund
) {
  const stripe =
    getStripe();

  let paymentIntentId =
    objectId(
      refund.payment_intent
    );

  const chargeId =
    objectId(
      refund.charge
    );

  /*
   * Refund normally contains payment_intent.
   * If not, retrieve the associated charge as fallback.
   */

  if (
    !paymentIntentId &&
    chargeId
  ) {
    try {
      const charge =
        await stripe
          .charges
          .retrieve(
            chargeId
          );

      paymentIntentId =
        objectId(
          charge.payment_intent
        );
    } catch (
      problem
    ) {
      console.warn(
        "Unable to resolve PaymentIntent for failed refund:",
        problem
      );
    }
  }

  if (
    !paymentIntentId
  ) {
    console.info(
      "BirdShop ignored failed refund without PaymentIntent:",
      {
        refundId:
          refund.id,

        chargeId,
      }
    );

    return;
  }

  const supabase =
    createAdminClient();

  const {
    data:
      orderId,

    error,
  } =
    await supabase.rpc(
      "birdshop_record_service_refund_failure",
      {
        p_payment_intent_id:
          paymentIntentId,

        p_charge_id:
          chargeId,

        p_refund_id:
          refund.id,

        p_failure_reason:
          refund.failure_reason ??
          "Stripe refund failed.",
      }
    );

  if (
    error
  ) {
    throw new Error(
      `BirdShop failed refund recording failed: ${error.message}`
    );
  }

  if (
    !orderId
  ) {
    console.info(
      "Failed Stripe refund did not belong to a BirdShop service order:",
      {
        paymentIntentId,

        refundId:
          refund.id,
      }
    );

    return;
  }

  console.warn(
    "BirdShop Stripe refund failed:",
    {
      orderId,

      paymentIntentId,

      refundId:
        refund.id,

      reason:
        refund.failure_reason,
    }
  );
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request:
    Request
) {
  const stripe =
    getStripe();

  let webhookSecret:
    string;

  try {
    webhookSecret =
      requireWebhookSecret();
  } catch (
    problem
  ) {
    console.error(
      "Stripe webhook configuration error:",
      problem
    );

    return NextResponse.json(
      {
        error:
          "Webhook is not configured.",
      },
      {
        status:
          500,
      }
    );
  }

  const signature =
    request.headers.get(
      "stripe-signature"
    );

  if (
    !signature
  ) {
    return NextResponse.json(
      {
        error:
          "Missing Stripe signature.",
      },
      {
        status:
          400,
      }
    );
  }

  const rawBody =
    await request.text();

  let event:
    Stripe.Event;

  try {
    event =
      stripe
        .webhooks
        .constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
  } catch (
    problem
  ) {
    console.error(
      "Invalid Stripe webhook signature:",
      problem instanceof
        Error
        ? problem.message
        : "Unknown signature error"
    );

    return NextResponse.json(
      {
        error:
          "Invalid Stripe signature.",
      },
      {
        status:
          400,
      }
    );
  }

  try {
    switch (
      event.type
    ) {
      /* ===================================================
         PAYMENT COMPLETE
      =================================================== */

      case "checkout.session.completed": {
        const session =
          event.data.object as
            Stripe.Checkout.Session;

        await finalizePaidCheckout(
          session
        );

        break;
      }

      /* ===================================================
         DELAYED PAYMENT COMPLETE
      =================================================== */

      case "checkout.session.async_payment_succeeded": {
        const session =
          event.data.object as
            Stripe.Checkout.Session;

        await finalizePaidCheckout(
          session
        );

        break;
      }

      /* ===================================================
         PARTIAL OR FULL REFUND
      =================================================== */

      case "charge.refunded": {
        const charge =
          event.data.object as
            Stripe.Charge;

        await synchronizeRefundedCharge(
          charge
        );

        break;
      }

      /* ===================================================
         REFUND FAILED
      =================================================== */

      case "refund.failed": {
        const refund =
          event.data.object as
            Stripe.Refund;

        await recordFailedRefund(
          refund
        );

        break;
      }

      default:
        break;
    }

    return NextResponse.json({
      received:
        true,

      eventId:
        event.id,
    });
  } catch (
    problem
  ) {
    console.error(
      "BirdShop Stripe webhook processing failed:",
      {
        eventId:
          event.id,

        eventType:
          event.type,

        message:
          problem instanceof
            Error
            ? problem.message
            : "Unknown processing error",
      }
    );

    return NextResponse.json(
      {
        error:
          "Stripe event could not be processed.",
      },
      {
        status:
          500,
      }
    );
  }
}