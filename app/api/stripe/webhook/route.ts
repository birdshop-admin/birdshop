import type Stripe from "stripe";
import { after } from "next/server";
import { getStripe } from "@/lib/stripe";
import { env, readBody } from "@/lib/server-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { processStripeEvent } from "@/lib/stripe-events";
import { drainEmailJobs } from "@/lib/email-jobs";
export const runtime = "nodejs";
export const maxDuration = 60;
const supported = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
]);
export async function POST(request: Request) {
  let event: Stripe.Event;
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature)
      return Response.json({ error: "Missing signature." }, { status: 400 });
    event = getStripe().webhooks.constructEvent(
      await readBody(request, 1048576),
      signature,
      env("STRIPE_WEBHOOK_SECRET"),
    );
  } catch {
    return Response.json(
      { error: "Invalid webhook signature or configuration." },
      { status: 400 },
    );
  }
  if (!supported.has(event.type)) return Response.json({ received: true });
  const db = createAdminClient();
  try {
    const { error: saveError } = await db
      .from("birdshop_stripe_events")
      .upsert(
        { id: event.id, type: event.type, payload: event },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (saveError) throw new Error("Could not durably save Stripe event.");
    const { data, error } = await db
      .from("birdshop_stripe_events")
      .select("processed_at")
      .eq("id", event.id)
      .single();
    if (error) throw new Error("Could not read Stripe event state.");
    if (!data.processed_at) await processStripeEvent(event);
    after(async () => {
      await drainEmailJobs(2).catch(() => undefined);
    });
    return Response.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Event processing failed (${error.name}).`
        : "Event processing failed";
    await db
      .from("birdshop_stripe_events")
      .update({ last_error: message.slice(0, 500) })
      .eq("id", event.id);
    console.error("BirdShop webhook retry required", {
      eventId: event.id,
      type: event.type,
      message,
    });
    return Response.json(
      { error: "Event processing incomplete; retry required." },
      { status: 500 },
    );
  }
}
