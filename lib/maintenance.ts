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
    // A paged lookup recovers a lost API response without creating a second session.
    const listing = stripe.checkout.sessions.list({
      created: {
        gte: Math.floor(new Date(attempt.created_at).getTime() / 1000) - 60,
        lte: Math.floor(new Date(attempt.expires_at).getTime() / 1000) + 60,
      },
      limit: 100,
    });
    let scanned = 0;
    let complete = true;
    for await (const s of listing) {
      if (s.metadata?.birdshop_attempt_id === attempt.id) {
        knownId = s.id;
        break;
      }
      if (++scanned >= 2000) {
        complete = false;
        break;
      }
    }
    // The saved Stripe request can never succeed once its expires_at has passed.
    // With no session anywhere in the creation window, release the hold so codes
    // and service quotes are not blocked forever.
    const savedExpiry = Number(
      (attempt.stripe_params as { expires_at?: number } | null)?.expires_at ?? 0,
    );
    if (
      !knownId &&
      complete &&
      attempt.stripe_params &&
      savedExpiry * 1000 < Date.now()
    ) {
      const released = await serverRpc<boolean>(
        "birdshop_v2_release_stale_checkout",
        { p_attempt_id: attempt.id },
      );
      if (released) return;
    }
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

const CLOSE_AFTER_COMPLETION_MS = 60 * 60 * 1000;

// A completed service chat stays open for an hour so the customer can say thanks
// or ask a last question, then closes with a short system message.
async function closeCompletedChats() {
  const db = createAdminClient();
  const { data: chats, error } = await db
    .from("service_conversations")
    .select("id,order_id")
    .eq("status", "open")
    .eq("conversation_type", "service")
    .eq("workflow_status", "completed")
    .is("deleted_at", null)
    .not("order_id", "is", null)
    .limit(50);
  if (error) throw new Error("Completed chats could not be read.");
  if (!chats?.length) return 0;

  const cutoff = new Date(Date.now() - CLOSE_AFTER_COMPLETION_MS).toISOString();
  const { data: orders, error: orderError } = await db
    .from("orders")
    .select("id")
    .in("id", chats.map((chat) => chat.order_id))
    .eq("service_status", "completed")
    .lt("fulfilled_at", cutoff);
  if (orderError) throw new Error("Completed orders could not be read.");

  const due = new Set((orders ?? []).map((order) => order.id));
  let closed = 0;
  for (const chat of chats) {
    if (!due.has(chat.order_id)) continue;
    const { data: updated, error: closeError } = await db
      .from("service_conversations")
      .update({ status: "closed" })
      .eq("id", chat.id)
      .eq("status", "open")
      .select("id");
    if (closeError || !updated?.length) continue;
    closed++;
    await db.from("service_messages").insert({
      conversation_id: chat.id,
      sender_type: "system",
      sender_label: "BirdShop",
      body: "This order is complete and this chat is now closed. Need anything else? Start a new conversation from My Service.",
      message_type: "system",
      metadata: { event: "chat_auto_closed" },
    });
  }
  return closed;
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
  // An email-state failure must not skip the rate-limit cleanup below.
  // Never let chat housekeeping stop email delivery or cleanup.
  const closedChats = await closeCompletedChats().catch(() => {
    console.error("BirdShop maintenance could not close completed chats");
    return 0;
  });
  let emailError: unknown = null;
  const email =
    Date.now() - started < 45_000
      ? await drainEmailJobs(6).catch((error: unknown) => {
          emailError = error;
          return { sent: 0 };
        })
      : { sent: 0 };
  await db
    .from("birdshop_rate_limits")
    .delete()
    .lt("window_start", new Date(Date.now() - 2 * 86400_000).toISOString());
  // Cleanup still ran; now fail the run so the scheduler shows the email outage.
  if (emailError) throw emailError;
  return { events, checkouts, emails: email.sent, closedChats };
}
