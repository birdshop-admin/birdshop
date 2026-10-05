import "server-only";
import { orderToken } from "@/lib/order-access";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { objectId, siteUrl } from "@/lib/server-config";

export type CheckoutAttempt = {
  id: string;
  kind: "service" | "product";
  cart:
    | {
        id: string;
        slug: string;
        name: string;
        quantity: number;
        unit_cents: number;
        line_cents: number;
      }[]
    | null;
  payment_request_id: string | null;
  order_id: string | null;
  expected_cents: number;
  currency: string;
  status: string;
  customer_name: string;
  customer_email: string;
  idempotency_key: string;
  stripe_session_id: string | null;
  stripe_url: string | null;
  stripe_params: Stripe.Checkout.SessionCreateParams | null;
  created_at: string;
  expires_at: string;
  cancel_requested_at: string | null;
  conversation_id?: string;
  reference?: string;
  title?: string;
  description?: string;
  public_token?: string;
};

export async function serverRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) {
    console.error("BirdShop RPC failed", { rpc: name, code: error.code });
    throw new Error("Payment processing requires reconciliation.");
  }
  return data as T;
}

export async function getAttempt(
  session: Stripe.Checkout.Session,
): Promise<CheckoutAttempt | null> {
  const db = createAdminClient();
  const id = session.metadata?.birdshop_attempt_id;
  const query = db.from("birdshop_checkout_attempts").select("*");
  const { data, error } = await (
    id ? query.eq("id", id) : query.eq("stripe_session_id", session.id)
  ).maybeSingle();
  if (error) throw new Error("Could not load checkout identity.");
  if (!data) {
    if (
      session.metadata?.birdshop_type ||
      session.metadata?.birdshop_payment_request_id
    )
      throw new Error("Known BirdShop checkout has no recorded attempt.");
    return null; // Other applications may use the same Stripe account.
  }
  const attempt = data as CheckoutAttempt;
  if (attempt.stripe_session_id && attempt.stripe_session_id !== session.id)
    throw new Error("Checkout session binding mismatch.");
  if (
    session.amount_total !== Number(attempt.expected_cents) ||
    session.currency !== attempt.currency ||
    session.mode !== "payment"
  )
    throw new Error("Checkout amount or currency mismatch.");
  if (id) {
    if (
      !attempt.stripe_params ||
      session.metadata?.birdshop_type !== attempt.kind ||
      (attempt.kind === "service" &&
        session.metadata?.birdshop_payment_request_id !==
          attempt.payment_request_id) ||
      session.client_reference_id !== attempt.id
    )
      throw new Error("Checkout metadata mismatch.");
  } else if (
    attempt.kind !== "service" ||
    session.client_reference_id !== attempt.payment_request_id ||
    session.metadata?.birdshop_type !== "service" ||
    session.metadata?.birdshop_payment_request_id !== attempt.payment_request_id
  ) {
    throw new Error("Legacy checkout metadata mismatch.");
  }
  if (attempt.kind === "service") {
    const { data: payment, error: lookupError } = await db
      .from("service_payment_requests")
      .select("conversation_id")
      .eq("id", attempt.payment_request_id!)
      .single();
    if (
      lookupError ||
      !payment ||
      payment.conversation_id !== session.metadata?.birdshop_conversation_id
    )
      throw new Error("Checkout conversation mismatch.");
  }
  return attempt;
}

export async function observeCheckout(
  session: Stripe.Checkout.Session,
  attempt: CheckoutAttempt,
) {
  if (!attempt.stripe_session_id)
    await serverRpc("birdshop_v2_bind_checkout", {
      p_attempt_id: attempt.id,
      p_session_id: session.id,
      p_url: session.url,
    });
  await serverRpc("birdshop_v2_observe_checkout", {
    p_attempt_id: attempt.id,
    p_session_id: session.id,
    p_intent_id: objectId(session.payment_intent),
    p_customer_id: objectId(session.customer),
    p_payment_status: session.payment_status,
  });
}

export async function finalizeCheckout(
  session: Stripe.Checkout.Session,
  checkRefund = true,
) {
  if (session.status !== "complete" || session.payment_status !== "paid")
    return null;
  const attempt = await getAttempt(session);
  if (!attempt) return null;
  const intent = objectId(session.payment_intent);
  if (!intent) throw new Error("Paid checkout has no PaymentIntent.");
  await observeCheckout(session, attempt);
  const orderId =
    attempt.kind === "product"
      ? await serverRpc<string>("birdshop_v2_finalize_product_payment", {
          p_attempt_id: attempt.id,
          p_session_id: session.id,
          p_intent_id: intent,
          p_amount: session.amount_total,
          p_currency: session.currency,
        })
      : await serverRpc<string>("birdshop_finalize_service_payment", {
          p_payment_request_id: attempt.payment_request_id,
          p_checkout_session_id: session.id,
          p_payment_intent_id: intent,
          p_stripe_customer_id: objectId(session.customer),
          p_amount_total: session.amount_total,
          p_currency: session.currency,
          p_customer_email:
            session.customer_details?.email ?? session.customer_email,
        });
  // A refund may have arrived before checkout.session.completed.
  if (checkRefund) {
    const paymentIntent = await getStripe().paymentIntents.retrieve(intent, {
      expand: ["latest_charge"],
    });
    const charge = paymentIntent.latest_charge;
    if (charge && typeof charge !== "string") {
      if (objectId(charge.payment_intent) !== intent)
        throw new Error("Charge payment identity mismatch.");
      await serverRpc("birdshop_v2_record_charge", {
        p_intent_id: intent,
        p_charge_id: charge.id,
        p_amount: charge.amount,
        p_currency: charge.currency,
      });
      if (charge.amount_refunded > 0) await synchronizeRefund(charge, false);
    }
  }
  return orderId;
}

export async function synchronizeRefund(
  charge: Stripe.Charge,
  recoverOrder = true,
) {
  const intent = objectId(charge.payment_intent);
  if (!intent) return;
  const db = createAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id")
    .eq("payment_provider", "stripe")
    .eq("payment_reference", intent)
    .maybeSingle();
  if (error) throw new Error("Could not locate refund order.");
  let known = false;
  if (!order && recoverOrder) {
    const sessions = await getStripe().checkout.sessions.list({
      payment_intent: intent,
      limit: 100,
    });
    for (const session of sessions.data) {
      if (
        session.metadata?.birdshop_type ||
        session.metadata?.birdshop_payment_request_id
      ) {
        known = true;
        await finalizeCheckout(session, false);
      }
    }
    if (!known) return;
  }
  const id = await serverRpc<string | null>("birdshop_sync_service_refund", {
    p_payment_intent_id: intent,
    p_charge_id: charge.id,
    p_amount_refunded: charge.amount_refunded,
    p_currency: charge.currency,
    p_is_fully_refunded: charge.refunded,
  });
  if (!id && (order || known || charge.metadata?.birdshop_type))
    throw new Error("Refund is waiting for its paid order.");
}

export async function synchronizeRefundFailure(
  refund: Stripe.Refund,
  charge: Stripe.Charge,
) {
  const intent =
    objectId(refund.payment_intent) ?? objectId(charge.payment_intent);
  if (!intent) return;
  const sessions = await getStripe().checkout.sessions.list({
    payment_intent: intent,
    limit: 100,
  });
  let known = false;
  for (const session of sessions.data) {
    if (
      ["service", "product"].includes(session.metadata?.birdshop_type ?? "") ||
      session.metadata?.birdshop_payment_request_id
    ) {
      known = true;
      await finalizeCheckout(session, false);
    }
  }
  const id = await serverRpc<string | null>(
    "birdshop_record_service_refund_failure",
    {
      p_payment_intent_id: intent,
      p_charge_id: charge.id,
      p_refund_id: refund.id,
      p_failure_reason: refund.failure_reason ?? "Refund failed",
    },
  );
  if (known && !id)
    throw new Error("Known refund failure is awaiting its linked order.");
}

export async function reconcileCheckout(session: Stripe.Checkout.Session) {
  const attempt = await getAttempt(session);
  if (!attempt) return;
  await observeCheckout(session, attempt);
  if (session.payment_status === "paid") {
    await finalizeCheckout(session);
    return;
  }
  if (session.status === "expired") {
    await serverRpc("birdshop_v2_close_checkout", {
      p_attempt_id: attempt.id,
      p_state: "expired",
    });
  } else if (session.status === "complete") {
    const db = createAdminClient();
    const { error } = await db
      .from("birdshop_checkout_attempts")
      .update({ status: "processing" })
      .eq("id", attempt.id)
      .in("status", ["creating", "open"]);
    if (error) throw new Error("Could not record processing checkout.");
    if (attempt.payment_request_id) {
      const { error: updateError } = await db
        .from("service_payment_requests")
        .update({ status: "processing" })
        .eq("id", attempt.payment_request_id)
        .eq("status", "pending");
      if (updateError) throw new Error("Could not record processing payment.");
    }
  }
}

function buildStripeParams(
  a: CheckoutAttempt,
): Stripe.Checkout.SessionCreateParams {
  const base = siteUrl();
  const returnPath =
    a.kind === "product"
      ? `/checkout/return?token=${orderToken(a.id)}`
      : `/service-chat?token=${encodeURIComponent(a.public_token!)}`;
  const metadata = {
    birdshop_attempt_id: a.id,
    birdshop_type: a.kind,
    ...(a.kind === "service"
      ? {
          birdshop_payment_request_id: a.payment_request_id!,
          birdshop_conversation_id: a.conversation_id!,
        }
      : {}),
  };
  return {
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: a.id,
    success_url: `${base}${returnPath}&payment=success`,
    cancel_url: `${base}${returnPath}&payment=cancelled`,
    expires_at: Math.floor(new Date(a.expires_at).getTime() / 1000),
    customer_email: a.customer_email,
    metadata,
    payment_intent_data: { metadata },
    line_items:
      a.kind === "product"
        ? (a.cart ?? []).map((item) => ({
            quantity: item.quantity,
            price_data: {
              currency: a.currency,
              unit_amount: Number(item.unit_cents),
              product_data: { name: item.name },
            },
          }))
        : [
            {
              quantity: 1,
              price_data: {
                currency: a.currency,
                unit_amount: Number(a.expected_cents),
                product_data: {
                  name: a.title || "BirdShop service",
                  ...(a.description
                    ? { description: a.description.slice(0, 450) }
                    : {}),
                },
              },
            },
          ],
  };
}

export async function startCheckout(
  attempt: CheckoutAttempt,
): Promise<string | null> {
  const stripe = getStripe();
  if (attempt.stripe_session_id) {
    const session = await stripe.checkout.sessions.retrieve(
      attempt.stripe_session_id,
    );
    await reconcileCheckout(session);
    if (
      session.status === "open" &&
      session.url &&
      !attempt.cancel_requested_at
    )
      return session.url;
    if (session.status === "expired") return null;
    throw new Error("Payment is being confirmed. Return to your conversation.");
  }
  if (attempt.status !== "creating")
    throw new Error(
      "This checkout needs review before another payment is started.",
    );
  if (
    Date.now() - new Date(attempt.created_at).getTime() >=
    23 * 60 * 60 * 1000
  )
    throw new Error(
      "This checkout needs reconciliation. Contact BirdShop before retrying.",
    );
  const db = createAdminClient();
  let params = attempt.stripe_params;
  if (!params) {
    // Persist the exact Stripe request BEFORE the network call. Concurrent retries use identical parameters.
    const { error } = await db
      .from("birdshop_checkout_attempts")
      .update({ stripe_params: buildStripeParams(attempt) })
      .eq("id", attempt.id)
      .eq("status", "creating")
      .is("stripe_params", null);
    if (error) throw new Error("Could not prepare checkout.");
    const { data, error: readError } = await db
      .from("birdshop_checkout_attempts")
      .select("stripe_params,status")
      .eq("id", attempt.id)
      .single();
    if (readError || !data?.stripe_params || data.status !== "creating")
      throw new Error("Checkout state changed. Please retry.");
    params = data.stripe_params as Stripe.Checkout.SessionCreateParams;
  }
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: attempt.idempotency_key,
  });
  try {
    await serverRpc("birdshop_v2_bind_checkout", {
      p_attempt_id: attempt.id,
      p_session_id: session.id,
      p_url: session.url,
    });
  } catch {
    if (session.status === "open") {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        /* Payment may have won the race. The persisted attempt and Stripe retries reconcile it. */
      }
    }
    await db
      .from("birdshop_checkout_attempts")
      .update({
        failure_reason:
          "Stripe session binding failed; reconciliation required.",
        next_check_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    console.error("BirdShop checkout binding requires reconciliation", {
      attemptId: attempt.id,
      sessionId: session.id,
    });
    throw new Error("Checkout could not be safely attached.");
  }
  await reconcileCheckout(session);
  if (session.status === "expired") return null;
  if (session.status !== "open" || !session.url)
    throw new Error("Payment is being confirmed. Please return to BirdShop.");
  return session.url;
}

export async function cancelQuote(
  requestId: string,
  conversationId: string,
  actorId: string,
) {
  const attempt = await serverRpc<CheckoutAttempt | null>(
    "birdshop_v2_begin_cancel",
    {
      p_request_id: requestId,
      p_conversation_id: conversationId,
      p_actor_id: actorId,
    },
  );
  if (!attempt) return;
  const stripe = getStripe();
  let session = await stripe.checkout.sessions.retrieve(
    attempt.stripe_session_id!,
  );
  if (session.status === "open") {
    try {
      session = await stripe.checkout.sessions.expire(session.id);
    } catch {
      session = await stripe.checkout.sessions.retrieve(session.id);
    }
  }
  await reconcileCheckout(session);
  if (session.status !== "expired")
    throw new Error(
      "Checkout has completed or is processing. It cannot be cancelled; the payment is being reconciled.",
    );
}
