import {
  NextResponse,
} from "next/server";

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
   TYPES
========================================================= */

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type CheckoutBody = {
  paymentRequestId?:
    unknown;
};

type ConversationRow = {
  id: string;

  public_token: string;

  reference: string;

  conversation_type: string;

  status: string;

  workflow_status: string;

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

  order_id:
    | string
    | null;

  deleted_at:
    | string
    | null;
};

type PaymentRequestRow = {
  id: string;

  conversation_id: string;

  order_id:
    | string
    | null;

  amount:
    | number
    | string;

  currency: string;

  title: string;

  description:
    | string
    | null;

  status: string;

  stripe_checkout_session_id:
    | string
    | null;

  stripe_payment_intent_id:
    | string
    | null;

  stripe_payment_status:
    | string
    | null;

  checkout_created_at:
    | string
    | null;

  paid_at:
    | string
    | null;

  cancelled_at:
    | string
    | null;
};

/* =========================================================
   HELPERS
========================================================= */

function jsonError(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status,
    }
  );
}

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function cleanText(
  value:
    | string
    | null
    | undefined,
  maxLength:
    number
) {
  return (
    value
      ?.trim()
      .replace(
        /\s+/g,
        " "
      )
      .slice(
        0,
        maxLength
      ) ??
    ""
  );
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    /* =====================================================
       TOKEN
    ===================================================== */

    const {
      token:
        rawToken,
    } =
      await context.params;

    const token =
      String(
        rawToken ??
        ""
      ).trim();

    if (!token) {
      return jsonError(
        "Private conversation token is required.",
        400
      );
    }

    /* =====================================================
       BODY
    ===================================================== */

    let body:
      CheckoutBody;

    try {
      body =
        await request.json() as
          CheckoutBody;
    } catch {
      return jsonError(
        "Invalid checkout request.",
        400
      );
    }

    const paymentRequestId =
      typeof body
        .paymentRequestId ===
        "string"
        ? body
            .paymentRequestId
            .trim()
        : "";

    if (
      !paymentRequestId ||
      !isUuid(
        paymentRequestId
      )
    ) {
      return jsonError(
        "Invalid payment request.",
        400
      );
    }

    /* =====================================================
       SERVER CLIENTS
    ===================================================== */

    const supabase =
      createAdminClient();

    const stripe =
      getStripe();

    /* =====================================================
       VERIFY CONVERSATION

       IMPORTANT:
       We verify directly using the private public_token.

       No order is required.
    ===================================================== */

    const {
      data:
        conversationData,

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
            "conversation_type",
            "status",
            "workflow_status",
            "customer_name",
            "customer_email",
            "service_name",
            "package_name",
            "order_id",
            "deleted_at",
          ].join(",")
        )
        .eq(
          "public_token",
          token
        )
        .is(
          "deleted_at",
          null
        )
        .maybeSingle();

    if (
      conversationError
    ) {
      console.error(
        "BirdShop checkout conversation lookup failed:",
        conversationError
      );

      return jsonError(
        "Unable to verify this private conversation.",
        500
      );
    }

    const conversation =
      conversationData as
        ConversationRow | null;

    if (!conversation) {
      return jsonError(
        "Private conversation not found.",
        404
      );
    }

    if (
      conversation.status !==
      "open"
    ) {
      return jsonError(
        "This conversation is no longer open.",
        409
      );
    }

    if (
      conversation
        .conversation_type !==
      "service"
    ) {
      return jsonError(
        "Payments are only available for service conversations.",
        409
      );
    }

    /*
     * Before Stripe succeeds there should still be no order.
     *
     * If an order already exists, we do not allow another
     * pre-order checkout to start.
     */

    if (
      conversation.order_id
    ) {
      return jsonError(
        "This service already has an order.",
        409
      );
    }

    /* =====================================================
       PAYMENT REQUEST

       IMPORTANT:
       Match by:
       - payment request ID
       - verified conversation ID

       DO NOT match by order_id.
    ===================================================== */

    const {
      data:
        paymentRequestData,

      error:
        paymentRequestError,
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
            "description",
            "status",
            "stripe_checkout_session_id",
            "stripe_payment_intent_id",
            "stripe_payment_status",
            "checkout_created_at",
            "paid_at",
            "cancelled_at",
          ].join(",")
        )
        .eq(
          "id",
          paymentRequestId
        )
        .eq(
          "conversation_id",
          conversation.id
        )
        .maybeSingle();

    if (
      paymentRequestError
    ) {
      console.error(
        "BirdShop checkout payment request lookup failed:",
        paymentRequestError
      );

      return jsonError(
        "Unable to load this payment request.",
        500
      );
    }

    const paymentRequest =
      paymentRequestData as
        PaymentRequestRow | null;

    if (!paymentRequest) {
      return jsonError(
        "Payment request not found.",
        404
      );
    }

    /* =====================================================
       REQUEST STATE
    ===================================================== */

    if (
      paymentRequest.status ===
        "paid" ||
      paymentRequest.paid_at
    ) {
      return jsonError(
        "This payment request has already been paid.",
        409
      );
    }

    if (
      paymentRequest.status ===
        "cancelled" ||
      paymentRequest.cancelled_at
    ) {
      return jsonError(
        "This payment request was cancelled.",
        409
      );
    }

    if (
      paymentRequest.status !==
      "pending"
    ) {
      return jsonError(
        "This payment request is no longer available.",
        409
      );
    }

    if (
      paymentRequest.order_id
    ) {
      return jsonError(
        "This payment request is already linked to an order.",
        409
      );
    }

    /* =====================================================
       SERVER-AUTHORITATIVE PRICE

       Browser cannot control this.
    ===================================================== */

    const amount =
      Number(
        paymentRequest.amount
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <
        0.5
    ) {
      return jsonError(
        "Invalid payment amount.",
        500
      );
    }

    const amountCents =
      Math.round(
        amount *
          100
      );

    if (
      !Number.isSafeInteger(
        amountCents
      ) ||
      amountCents <
        50
    ) {
      return jsonError(
        "Invalid payment amount.",
        500
      );
    }

    const currency =
      String(
        paymentRequest
          .currency ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      !/^[a-z]{3}$/.test(
        currency
      )
    ) {
      return jsonError(
        "Invalid payment currency.",
        500
      );
    }

    /* =====================================================
       REUSE OPEN CHECKOUT SESSION
    ===================================================== */

    const existingSessionId =
      paymentRequest
        .stripe_checkout_session_id;

    if (
      existingSessionId
    ) {
      try {
        const existingSession =
          await stripe
            .checkout
            .sessions
            .retrieve(
              existingSessionId
            );

        if (
          existingSession.status ===
            "open" &&
          existingSession.url
        ) {
          return NextResponse.json({
            ok:
              true,

            reused:
              true,

            url:
              existingSession.url,

            sessionId:
              existingSession.id,
          });
        }

        if (
          existingSession.status ===
          "complete"
        ) {
          return jsonError(
            "This payment is already being confirmed.",
            409
          );
        }
      } catch (
        problem
      ) {
        console.warn(
          "BirdShop could not reuse old Stripe Checkout Session:",
          problem
        );
      }
    }

    /* =====================================================
       RETURN URL

       Local:
       http://localhost:3000

       Production later:
       https://www.birdshop.store
    ===================================================== */

    const origin =
      new URL(
        request.url
      ).origin;

    const encodedToken =
      encodeURIComponent(
        token
      );

    const successUrl =
      `${origin}/service-chat?token=${encodedToken}&payment=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${origin}/service-chat?token=${encodedToken}&payment=cancelled`;

    /* =====================================================
       STRIPE DISPLAY
    ===================================================== */

    const title =
      cleanText(
        paymentRequest.title,
        120
      ) ||
      "BirdShop Service";

    const description =
      cleanText(
        paymentRequest.description,
        450
      );

    const reference =
      cleanText(
        conversation.reference,
        200
      );

    /* =====================================================
       METADATA

       No order_id yet.

       That is intentional.
    ===================================================== */

    const metadata = {
      birdshop_payment_request_id:
        paymentRequest.id,

      birdshop_conversation_id:
        conversation.id,

      birdshop_reference:
        reference,

      birdshop_type:
        "service",
    };

    /* =====================================================
       CREATE CHECKOUT
    ===================================================== */

    const session =
      await stripe
        .checkout
        .sessions
        .create(
          {
            mode:
              "payment",

            client_reference_id:
              paymentRequest.id,

            success_url:
              successUrl,

            cancel_url:
              cancelUrl,

            customer_email:
              conversation
                .customer_email
                ?.trim() ||
              undefined,

            line_items: [
              {
                quantity:
                  1,

                price_data: {
                  currency,

                  unit_amount:
                    amountCents,

                  product_data: {
                    name:
                      title,

                    ...(description
                      ? {
                          description,
                        }
                      : {}),
                  },
                },
              },
            ],

            metadata,

            payment_intent_data: {
              metadata,
            },

            automatic_tax: {
              enabled:
                false,
            },

            submit_type:
              "pay",
          },
          {
            idempotencyKey:
              `birdshop-checkout-${paymentRequest.id}`,
          }
        );

    if (
      !session.url
    ) {
      return jsonError(
        "Stripe did not return a secure Checkout URL.",
        502
      );
    }

    /* =====================================================
       STORE SESSION

       IMPORTANT:
       Still:
       status = pending
       order_id = NULL

       We do NOT mark anything paid here.
    ===================================================== */

    const {
      error:
        saveError,
    } =
      await supabase
        .from(
          "service_payment_requests"
        )
        .update({
          stripe_checkout_session_id:
            session.id,

          stripe_payment_status:
            session
              .payment_status,

          checkout_created_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          paymentRequest.id
        )
        .eq(
          "conversation_id",
          conversation.id
        )
        .eq(
          "status",
          "pending"
        )
        .is(
          "order_id",
          null
        );

    if (
      saveError
    ) {
      console.error(
        "BirdShop failed to save Stripe Checkout Session:",
        saveError
      );

      try {
        await stripe
          .checkout
          .sessions
          .expire(
            session.id
          );
      } catch {
        // Best-effort cleanup.
      }

      return jsonError(
        "Checkout could not be safely attached to this payment request.",
        500
      );
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    return NextResponse.json({
      ok:
        true,

      reused:
        false,

      url:
        session.url,

      sessionId:
        session.id,
    });
  } catch (
    problem
  ) {
    console.error(
      "BirdShop Stripe Checkout error:",
      problem
    );

    return jsonError(
      problem instanceof
        Error
        ? problem.message
        : "Unable to start secure checkout.",
      500
    );
  }
}