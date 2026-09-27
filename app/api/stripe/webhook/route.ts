import {
  NextResponse,
} from "next/server";

import type Stripe from "stripe";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getStripe,
} from "@/lib/stripe";

/* =========================================================
   RUNTIME
========================================================= */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function requireWebhookSecret() {
  const value =
    process.env
      .STRIPE_WEBHOOK_SECRET
      ?.trim();

  if (!value) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not configured."
    );
  }

  return value;
}

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

/* =========================================================
   FINALIZE PAID CHECKOUT
========================================================= */

async function finalizePaidCheckout(
  session:
    Stripe.Checkout.Session
) {
  /* =======================================================
     ONLY PAYMENT CHECKOUTS
  ======================================================= */

  if (
    session.mode !==
    "payment"
  ) {
    return;
  }


  /*
   * checkout.session.completed can fire before some
   * asynchronous payment methods actually settle.
   *
   * Only a Stripe session marked PAID may create an order.
   */

  if (
    session.payment_status !==
    "paid"
  ) {
    return;
  }


  /* =======================================================
     BIRDSHOP IDENTIFIERS
  ======================================================= */

  const paymentRequestId =
    session.metadata
      ?.birdshop_payment_request_id
      ?.trim() ||
    session.client_reference_id
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


  /* =======================================================
     STRIPE PAYMENT VALUES
  ======================================================= */

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
    session.customer_details
      ?.email ??
    session.customer_email ??
    null;


  /* =======================================================
     ATOMIC SUPABASE FINALIZATION
  ======================================================= */

  const supabase =
    createAdminClient();


  const {
    data:
      orderId,

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


  if (error) {
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


  console.info(
    "BirdShop Stripe payment finalized:",
    {
      paymentRequestId,

      orderId,

      sessionId:
        session.id,
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


  /* =======================================================
     SIGNATURE
  ======================================================= */

  const signature =
    request.headers.get(
      "stripe-signature"
    );


  if (!signature) {
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


  /* =======================================================
     RAW BODY

     IMPORTANT:
     Stripe signature verification requires the exact raw
     request body. Do NOT call request.json() first.
  ======================================================= */

  const rawBody =
    await request.text();


  let event:
    Stripe.Event;

  try {
    event =
      stripe.webhooks
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


  /* =======================================================
     EVENTS
  ======================================================= */

  try {
    switch (
      event.type
    ) {
      /* ===================================================
         NORMAL CARD / IMMEDIATE PAYMENT
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
         ASYNC PAYMENT METHOD FINISHED LATER
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
         EVERYTHING ELSE

         We acknowledge it without changing an order.
      =================================================== */

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
    /*
     * Return 500 so Stripe retries the webhook.
     *
     * Our database function is idempotent, so retrying is
     * safe.
     */

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