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

export const runtime =
  "nodejs";

async function processPaidSession(
  session:
    Stripe.Checkout.Session
) {
  if (
    session.payment_status !==
    "paid"
  ) {
    return;
  }

  const paymentRequestId =
    session.metadata
      ?.payment_request_id;

  if (!paymentRequestId) {
    return;
  }

  const supabase =
    createAdminClient();

  const {
    data:
      paymentRequest,
  } =
    await supabase
      .from(
        "service_payment_requests"
      )
      .select(
        "id, conversation_id, order_id, amount, currency, status"
      )
      .eq(
        "id",
        paymentRequestId
      )
      .maybeSingle();

  if (
    !paymentRequest ||
    paymentRequest.status ===
      "paid"
  ) {
    return;
  }

  if (
    paymentRequest.status !==
    "pending"
  ) {
    return;
  }

  const expectedAmount =
    Math.round(
      Number(
        paymentRequest.amount
      ) * 100
    );

  if (
    session.amount_total !==
    expectedAmount
  ) {
    throw new Error(
      "Stripe payment amount does not match BirdShop payment request."
    );
  }

  if (
    session.currency
      ?.toLowerCase() !==
    String(
      paymentRequest.currency
    ).toLowerCase()
  ) {
    throw new Error(
      "Stripe payment currency does not match BirdShop payment request."
    );
  }

  const {
    data:
      order,
  } =
    await supabase
      .from(
        "orders"
      )
      .select(
        "id, service_status"
      )
      .eq(
        "id",
        paymentRequest.order_id
      )
      .maybeSingle();

  if (!order) {
    throw new Error(
      "BirdShop order not found."
    );
  }

  const paidAt =
    new Date()
      .toISOString();

  const paymentReference =
    typeof session.payment_intent ===
    "string"
      ? session.payment_intent
      : session.id;

  /*
   * Update the order first.
   *
   * If anything fails afterward, Stripe will retry the
   * webhook and BirdShop can finish synchronizing.
   */
  const nextServiceStatus =
    [
      "new",
      "discussing",
      "quote_sent",
      "awaiting_payment",
      "customer_replied",
    ].includes(
      order.service_status ??
        ""
    )
      ? "new"
      : order.service_status;

  const {
    error:
      orderError,
  } =
    await supabase
      .from(
        "orders"
      )
      .update({
        payment_status:
          "paid",

        payment_provider:
          "stripe",

        payment_reference:
          paymentReference,

        paid_at:
          paidAt,

        order_status:
          "active",

        subtotal:
          Number(
            paymentRequest.amount
          ),

        total:
          Number(
            paymentRequest.amount
          ),

        package_price:
          Number(
            paymentRequest.amount
          ),

        service_status:
          nextServiceStatus,
      })
      .eq(
        "id",
        paymentRequest.order_id
      );

  if (orderError) {
    throw orderError;
  }

  const {
    data:
      updatedRequest,

    error:
      requestError,
  } =
    await supabase
      .from(
        "service_payment_requests"
      )
      .update({
        status:
          "paid",

        paid_at:
          paidAt,

        stripe_payment_intent:
          paymentReference,
      })
      .eq(
        "id",
        paymentRequest.id
      )
      .eq(
        "status",
        "pending"
      )
      .select(
        "id"
      )
      .maybeSingle();

  if (requestError) {
    throw requestError;
  }

  /*
   * Only add the system message when this webhook was the
   * request that actually changed Pending -> Paid.
   *
   * This prevents duplicate webhook messages.
   */
  if (updatedRequest) {
    await supabase
      .from(
        "service_messages"
      )
      .insert({
        conversation_id:
          paymentRequest
            .conversation_id,

        sender_type:
          "system",

        sender_label:
          "BirdShop",

        body:
          `Payment received: $${Number(
            paymentRequest.amount
          ).toFixed(2)}`,

        message_type:
          "system",

        metadata: {
          payment_request_id:
            paymentRequest.id,

          payment_status:
            "paid",
        },
      });
  }
}

export async function POST(
  request: Request
) {
  const signature =
    request.headers.get(
      "stripe-signature"
    );

  const webhookSecret =
    process.env
      .STRIPE_WEBHOOK_SECRET;

  if (
    !signature ||
    !webhookSecret
  ) {
    return NextResponse.json(
      {
        error:
          "Webhook configuration missing.",
      },
      {
        status: 400,
      }
    );
  }

  const stripe =
    getStripe();

  const rawBody =
    await request.text();

  let event:
    Stripe.Event;

  try {
    event =
      stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid Stripe signature.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    if (
      event.type ===
        "checkout.session.completed" ||
      event.type ===
        "checkout.session.async_payment_succeeded"
    ) {
      await processPaidSession(
        event.data
          .object as Stripe.Checkout.Session
      );
    }

    return NextResponse.json({
      received:
        true,
    });
  } catch (
    problem
  ) {
    console.error(
      "BirdShop Stripe webhook error:",
      problem
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}