import {
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getStripe,
} from "@/lib/stripe";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function validEmail(
  value:
    | string
    | null
) {
  if (!value) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      token,
    } =
      await context.params;

    const body =
      await request.json();

    const paymentRequestId =
      String(
        body.paymentRequestId ??
          ""
      ).trim();

    if (
      !token ||
      !paymentRequestId
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid payment request.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      createAdminClient();

    const {
      data:
        conversation,
    } =
      await supabase
        .from(
          "service_conversations"
        )
        .select(
          "id, order_id, public_token, status, deleted_at"
        )
        .eq(
          "public_token",
          token
        )
        .maybeSingle();

    if (
      !conversation ||
      conversation.deleted_at ||
      conversation.status !==
        "open"
    ) {
      return NextResponse.json(
        {
          error:
            "Conversation unavailable.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data:
        paymentRequest,
    } =
      await supabase
        .from(
          "service_payment_requests"
        )
        .select("*")
        .eq(
          "id",
          paymentRequestId
        )
        .eq(
          "conversation_id",
          conversation.id
        )
        .eq(
          "order_id",
          conversation.order_id
        )
        .maybeSingle();

    if (
      !paymentRequest
    ) {
      return NextResponse.json(
        {
          error:
            "Payment request not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      paymentRequest.status !==
      "pending"
    ) {
      return NextResponse.json(
        {
          error:
            paymentRequest.status ===
            "paid"
              ? "This payment request is already paid."
              : "This payment request is no longer active.",
        },
        {
          status: 400,
        }
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
          "id, reference, customer_email, customer_name, payment_status"
        )
        .eq(
          "id",
          conversation.order_id
        )
        .maybeSingle();

    if (!order) {
      return NextResponse.json(
        {
          error:
            "Service order not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      order.payment_status ===
      "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "This service order is already paid.",
        },
        {
          status: 400,
        }
      );
    }

    const stripe =
      getStripe();

    /*
     * Reuse an existing open Stripe session instead of
     * accidentally creating multiple checkout sessions.
     */
    if (
      paymentRequest
        .stripe_checkout_session_id
    ) {
      try {
        const existing =
          await stripe.checkout.sessions.retrieve(
            paymentRequest
              .stripe_checkout_session_id
          );

        if (
          existing.status ===
            "open" &&
          existing.url
        ) {
          return NextResponse.json({
            url:
              existing.url,
          });
        }
      } catch {
        // Existing session is unavailable.
        // BirdShop creates a fresh one below.
      }
    }

    const amountCents =
      Math.round(
        Number(
          paymentRequest.amount
        ) * 100
      );

    if (
      !Number.isFinite(
        amountCents
      ) ||
      amountCents < 50
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid payment amount.",
        },
        {
          status: 400,
        }
      );
    }

    const origin =
      new URL(
        request.url
      ).origin;

    const returnUrl =
      `${origin}/service-chat?token=${encodeURIComponent(
        token
      )}`;

    const session =
      await stripe.checkout.sessions.create({
        mode:
          "payment",

        client_reference_id:
          paymentRequest.id,

        success_url:
          `${returnUrl}&payment=success`,

        cancel_url:
          `${returnUrl}&payment=cancelled`,

        customer_email:
          validEmail(
            order.customer_email
          )
            ? order.customer_email
            : undefined,

        line_items: [
          {
            quantity: 1,

            price_data: {
              currency:
                String(
                  paymentRequest.currency
                ).toLowerCase(),

              unit_amount:
                amountCents,

              product_data: {
                name:
                  paymentRequest.title,

                description:
                  paymentRequest.description ||
                  undefined,
              },
            },
          },
        ],

        metadata: {
          payment_request_id:
            paymentRequest.id,

          order_id:
            order.id,

          conversation_id:
            conversation.id,

          order_reference:
            order.reference,
        },
      });

    await supabase
      .from(
        "service_payment_requests"
      )
      .update({
        stripe_checkout_session_id:
          session.id,

        stripe_checkout_url:
          session.url,
      })
      .eq(
        "id",
        paymentRequest.id
      );

    if (!session.url) {
      return NextResponse.json(
        {
          error:
            "Stripe did not return a checkout URL.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      url:
        session.url,
    });
  } catch (
    problem
  ) {
    return NextResponse.json(
      {
        error:
          problem instanceof
            Error
            ? problem.message
            : "Unable to start checkout.",
      },
      {
        status: 500,
      }
    );
  }
}