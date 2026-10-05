import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { processStripeEvent } from "@/lib/stripe-events";
import {
  reconcileCheckout,
  getAttempt,
  serverRpc,
  startCheckout,
  type CheckoutAttempt,
} from "@/lib/payment-service";
import { drainEmailJobs } from "@/lib/email-jobs";

export async function recoverCheckoutAttempt(
  attempt: CheckoutAttempt,
  sessionId?: string,
) {
  const stripe = getStripe();
  let knownId = sessionId || attempt.stripe_session_id;
  if (!knownId && !attempt.stripe_params) {
    const released = await serverRpc<boolean>(
      "birdshop_v2_abandon_unstarted_checkout",
      { p_attempt_id: attempt.id },
    );
    if (released) return;
    throw new Error(
      "This checkout has not expired or its state changed. Retry shortly.",
    );
  }
  if (!knownId) {
    // A bounded lookup recovers a lost API response without creating a second session.
    const sessions = await stripe.checkout.sessions.list({
      created: {
        gte: Math.floor(new Date(attempt.created_at).getTime() / 1000) - 60,
        lte: Math.floor(new Date(attempt.expires_at).getTime() / 1000) + 60,
      },
      limit: 100,
    });
    knownId =
      sessions.data.find((s) => s.metadata?.birdshop_attempt_id === attempt.id)
        ?.id ?? null;
    if (
      !knownId &&
      attempt.status === "creating" &&
      Date.now() - new Date(attempt.created_at).getTime() < 23 * 3600_000
    ) {
      // Retrying the exact persisted request is safe within the provider idempotency window.
      await startCheckout(attempt);
      return;
    }
    if (!knownId)
      throw new Error(
        "No matching session was found in this bounded lookup. Check Stripe using the attempt ID and reconcile its cs_ session ID. The attempt remains blocked pending reconciliation.",
      );
  }
  let session = await stripe.checkout.sessions.retrieve(knownId);
  const verified = await getAttempt(session);
  if (!verified || verified.id !== attempt.id)
    throw new Error(
      "That Stripe session does not match this checkout attempt.",
    );
  if (!verified.stripe_session_id)
    await serverRpc("birdshop_v2_bind_checkout", {
      p_attempt_id: attempt.id,
      p_session_id: session.id,
      p_url: session.url,
    });
  if (attempt.cancel_requested_at && session.status === "open") {
    try {
      session = await stripe.checkout.sessions.expire(session.id);
    } catch {
      session = await stripe.checkout.sessions.retrieve(session.id);
    }
  }
  await reconcileCheckout(session);
}

export async function runMaintenance() {
  const db = createAdminClient();
  const started = Date.now();
  let events = 0,
    checkouts = 0;
  const { data: pending, error } = await db
    .from("birdshop_stripe_events")
    .select("id,payload,attempts")
    .is("processed_at", null)
    .order("attempts")
    .order("created_at")
    .limit(5);
  if (error) throw new Error("Could not read pending processor events.");
  for (const event of pending ?? []) {
    if (Date.now() - started > 30_000) break;
    try {
      await processStripeEvent(event.payload as Stripe.Event);
      events++;
    } catch (problem) {
      await db
        .from("birdshop_stripe_events")
        .update({
          attempts: event.attempts + 1,
          last_error:
            problem instanceof Error
              ? `Processor retry failed (${problem.name}).`
              : "Retry failed",
        })
        .eq("id", event.id);
    }
  }
  const { data: attempts, error: attemptError } = await db
    .from("birdshop_checkout_attempts")
    .select("*")
    .in("status", ["creating", "open", "processing"])
    .lte("next_check_at", new Date().toISOString())
    .or(
      `expires_at.lt.${new Date().toISOString()},cancel_requested_at.not.is.null`,
    )
    .order("next_check_at")
    .limit(5);
  if (attemptError) throw new Error("Could not read pending checkouts.");
  for (const raw of attempts ?? []) {
    if (Date.now() - started > 40_000) break;
    const attempt = raw as CheckoutAttempt;
    try {
      await recoverCheckoutAttempt(attempt);
      checkouts++;
    } catch {
      // Flag unresolved sessions for owner review; never restart an uncertain payment.
      if (
        !attempt.stripe_session_id &&
        Date.now() - new Date(attempt.created_at).getTime() >= 23 * 3600_000
      )
        await db
          .from("birdshop_checkout_attempts")
          .update({ status: "attention" })
          .eq("id", attempt.id)
          .eq("status", "creating");
    } finally {
      await db
        .from("birdshop_checkout_attempts")
        .update({ next_check_at: new Date(Date.now() + 300_000).toISOString() })
        .eq("id", attempt.id);
    }
  }
  const email =
    Date.now() - started < 45_000 ? await drainEmailJobs(3) : { sent: 0 };
  await db
    .from("birdshop_rate_limits")
    .delete()
    .lt("window_start", new Date(Date.now() - 2 * 86400_000).toISOString());
  return { events, checkouts, emails: email.sent };
}
