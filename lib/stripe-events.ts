import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import {
  finalizeCheckout,
  getAttempt,
  reconcileCheckout,
  serverRpc,
  synchronizeRefund,
  synchronizeRefundFailure,
  observeCheckout,
} from "@/lib/payment-service";

export async function processStripeEvent(event: Stripe.Event) {
  const stripe = getStripe();
  if (event.type.startsWith("checkout.session.")) {
    // Re-fetch current processor state; an old event must not reverse a newer state.
    const session = await stripe.checkout.sessions.retrieve(
      (event.data.object as Stripe.Checkout.Session).id,
    );
    if (session.payment_status === "paid") await finalizeCheckout(session);
    else if (event.type === "checkout.session.async_payment_failed") {
      const attempt = await getAttempt(session);
      if (attempt) {
        await observeCheckout(session, attempt);
        await serverRpc("birdshop_v2_close_checkout", {
          p_attempt_id: attempt.id,
          p_state: "failed",
        });
      }
    } else await reconcileCheckout(session);
  } else if (event.type === "charge.refunded") {
    const charge = await stripe.charges.retrieve(
      (event.data.object as Stripe.Charge).id,
    );
    await synchronizeRefund(charge);
  } else if (
    event.type === "refund.updated" ||
    event.type === "refund.created" ||
    event.type === "refund.failed"
  ) {
    const refund = await stripe.refunds.retrieve(
      (event.data.object as Stripe.Refund).id,
    );
    const chargeId =
      typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      if (charge.amount_refunded > 0) await synchronizeRefund(charge);
      if (refund.status === "failed")
        await synchronizeRefundFailure(refund, charge);
    }
  }
  const { error } = await createAdminClient()
    .from("birdshop_stripe_events")
    .update({ processed_at: new Date().toISOString(), last_error: null })
    .eq("id", event.id);
  if (error) throw new Error("Could not acknowledge the saved Stripe event.");
}
