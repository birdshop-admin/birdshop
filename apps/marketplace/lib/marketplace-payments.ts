import "server-only";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, getMarketplaceStripe } from "@/lib/stripe";
import { env, isUuid, objectId, siteUrl } from "@/lib/server-config";
import { commissionAmount } from "@/lib/seller-tiers";
import { getSellerConnect, refreshSellerConnect } from "@/lib/stripe-connect";

export type MarketplaceOrder = {
  id: string; listing_id: string; seller_id: string; buyer_user_id: string; quantity: number;
  subtotal_cents: number; commission_bps: number; commission_cents: number; currency: string;
  stripe_destination: string; stripe_checkout_session_id: string | null;
  checkout_expires_at: string; checkout_key: string; listing_title: string; state: string;
};
export function marketplaceCheckoutEnabled() { return process.env.BIRDSHOP_MARKETPLACE_CHECKOUT_ENABLED === "true"; }
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) throw new Error(`Marketplace database operation failed (${name}): ${error.message}`);
  return data;
}
export function marketplaceSessionParams(order: MarketplaceOrder, origin: string): Stripe.Checkout.SessionCreateParams {
  if (order.currency !== "usd" || commissionAmount(Number(order.subtotal_cents), order.commission_bps) !== Number(order.commission_cents))
    throw new Error("Marketplace price or commission snapshot is invalid.");
  return {
    mode: "payment", payment_method_types: ["card"],
    client_reference_id: order.id,
    metadata: { birdshop_marketplace_order_id: order.id },
    payment_intent_data: {
      metadata: { birdshop_marketplace_order_id: order.id },
      application_fee_amount: Number(order.commission_cents),
      transfer_data: { destination: order.stripe_destination },
    },
    line_items: [{ quantity: order.quantity, price_data: { currency: "usd",
      unit_amount: Number(order.subtotal_cents) / order.quantity,
      product_data: { name: order.listing_title } } }],
    expires_at: Math.floor(Date.parse(order.checkout_expires_at) / 1000),
    success_url: `${origin}/marketplace/orders?checkout=returned`,
    cancel_url: `${origin}/marketplace/orders?checkout=cancelled`,
  };
}
export async function startMarketplaceCheckout(buyerId: string, listingId: string, quantity: number, key: string) {
  if (!marketplaceCheckoutEnabled()) throw new Error("Marketplace checkout is not enabled in this environment.");
  if (!isUuid(listingId) || !isUuid(key) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10)
    throw new Error("Invalid listing, quantity, or checkout request.");
  const db = createAdminClient();
  const { data: listing, error } = await db.from("birdshop_marketplace_listings").select("seller_id").eq("id", listingId).single();
  if (error || !listing) throw new Error("Listing is unavailable.");
  const mapping = await getSellerConnect(listing.seller_id);
  if (!mapping?.stripe_account_id) throw new Error("Seller has not connected Stripe.");
  const current = await refreshSellerConnect(mapping);
  if (current.closed || current.transfers_status !== "active") throw new Error("Seller verification is incomplete.");
  const order = await rpc("birdshop_reserve_marketplace_checkout", {
    p_buyer: buyerId, p_listing: listingId, p_quantity: quantity, p_key: key,
  }) as MarketplaceOrder;
  if (order.buyer_user_id !== buyerId || order.state !== "payment_pending") throw new Error("Checkout is no longer unpaid.");
  const stripe = getMarketplaceStripe();
  let session: Stripe.Checkout.Session;
  if (order.stripe_checkout_session_id) session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
  else {
    if (Date.parse(order.checkout_expires_at) < Date.now() + 30 * 60_000)
      throw new Error("This checkout request is being reconciled. Use a new request after it expires.");
    session = await stripe.checkout.sessions.create(marketplaceSessionParams(order, siteUrl()), {
      idempotencyKey: `birdshop-marketplace-checkout-${order.id}`,
    });
    const saved = await db.from("birdshop_marketplace_orders").update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id).is("stripe_checkout_session_id", null);
    if (saved.error) throw new Error("Checkout was created but could not be saved. Retry this same request.");
  }
  if (session.status !== "open" || !session.url) throw new Error("Stripe checkout is no longer open. Review your orders.");
  return session.url;
}
async function orderForCharge(charge: Stripe.Charge) {
  const intentId = objectId(charge.payment_intent);
  if (!intentId) return null;
  const intent = await getStripe().paymentIntents.retrieve(intentId);
  const id = intent.metadata.birdshop_marketplace_order_id;
  if (!id) return null;
  getMarketplaceStripe(); // Enforce sandbox only after identifying a marketplace payment.
  if (charge.livemode || intent.livemode) throw new Error("Live marketplace payments are disabled.");
  if (!isUuid(id)) throw new Error("Invalid marketplace Stripe metadata.");
  const { data, error } = await createAdminClient().from("birdshop_marketplace_orders").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Marketplace payment has no matching order.");
  if (objectId(intent.latest_charge) !== charge.id || intent.status !== "succeeded" ||
      intent.amount_received !== Number(data.subtotal_cents)) throw new Error("Stripe payment is not a settled order payment.");
  return { order: data as MarketplaceOrder, intent };
}
export async function synchronizeMarketplaceCharge(charge: Stripe.Charge, eventId: string, forceFraud = false) {
  const found = await orderForCharge(charge);
  if (!found) return false;
  const { order, intent } = found;
  const disputes = await getMarketplaceStripe().disputes.list({ charge: charge.id, limit: 100 });
  if (disputes.has_more) throw new Error("Dispute reconciliation needs additional pages.");
  const dispute = disputes.data.find(d => !["won", "warning_closed"].includes(d.status)) ?? disputes.data[0];
  if (charge.currency !== "usd" || charge.amount !== Number(order.subtotal_cents) ||
      objectId(charge.transfer_data?.destination) !== order.stripe_destination ||
      (charge.application_fee_amount ?? 0) !== Number(order.commission_cents) || !charge.paid || !charge.captured)
    throw new Error("Stripe charge destination, amount, or application fee differs from the saved order.");
  await rpc("birdshop_apply_marketplace_charge", {
    p_order: order.id, p_event: eventId, p_charge: charge.id, p_payment_intent: intent.id,
    p_amount: charge.amount, p_currency: charge.currency,
    p_destination: objectId(charge.transfer_data?.destination), p_fee: charge.application_fee_amount ?? 0,
    p_refunded: charge.amount_refunded,
    p_fraud: forceFraud || charge.fraud_details?.user_report === "fraudulent" || charge.fraud_details?.stripe_report === "fraudulent",
    p_dispute: dispute?.status ?? null, p_paid: charge.paid && charge.captured,
  });
  return true;
}
export async function processMarketplaceStripeEvent(event: Stripe.Event) {
  const stripe = getStripe();
  if (event.type.startsWith("checkout.session.")) {
    // Read metadata on a freshly fetched session; browser return URLs never confirm payment.
    const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
    const orderId = session.metadata?.birdshop_marketplace_order_id;
    if (!orderId) return false;
    getMarketplaceStripe();
    if (session.livemode) throw new Error("Live marketplace checkout is disabled.");
    const { data: order, error } = await createAdminClient().from("birdshop_marketplace_orders")
      .select("*").eq("id", orderId).single();
    if (error || !order || (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== session.id) ||
        session.amount_total !== Number(order.subtotal_cents) || session.currency !== order.currency)
      throw new Error("Marketplace Checkout does not match the saved order.");
    const saved = await createAdminClient().from("birdshop_marketplace_orders").update({ stripe_checkout_session_id: session.id })
      .eq("id", orderId).is("stripe_checkout_session_id", null);
    if (saved.error) throw new Error("Unable to save Stripe Checkout identity.");
    const intentId = objectId(session.payment_intent);
    if (session.payment_status === "paid" && intentId) {
      const intent = await stripe.paymentIntents.retrieve(intentId);
      const chargeId = objectId(intent.latest_charge);
      if (!chargeId) throw new Error("Paid checkout is missing its charge.");
      await synchronizeMarketplaceCharge(await stripe.charges.retrieve(chargeId), event.id);
    } else if (session.status === "expired") await rpc("birdshop_expire_marketplace_checkout", { p_order: orderId });
    return true;
  }
  let chargeId: string | null = null;
  if (["charge.refunded", "charge.updated", "charge.succeeded"].includes(event.type)) chargeId = (event.data.object as Stripe.Charge).id;
  else if (event.type.startsWith("refund.")) {
    const refund = await stripe.refunds.retrieve((event.data.object as Stripe.Refund).id);
    chargeId = objectId(refund.charge);
  } else if (event.type.startsWith("charge.dispute.")) chargeId = objectId((event.data.object as Stripe.Dispute).charge);
  else if (event.type === "radar.early_fraud_warning.created") chargeId = objectId((event.data.object as Stripe.Radar.EarlyFraudWarning).charge);
  if (!chargeId) return false;
  return synchronizeMarketplaceCharge(await stripe.charges.retrieve(chargeId), event.id,
    event.type === "radar.early_fraud_warning.created");
}
/** Runs under existing authenticated maintenance. Recover missed webhooks and expired reservations. */
export async function reconcileMarketplacePayments() {
  if (!marketplaceCheckoutEnabled()) return;
  const db = createAdminClient();
  const { data, error } = await db.from("birdshop_marketplace_orders").select("*")
    .not("checkout_key", "is", null).not("state", "in", "(refunded,cancelled)")
    .order("stripe_reconciled_at", { ascending: true, nullsFirst: true }).limit(5);
  if (error) throw new Error("Marketplace reconciliation query failed.");
  const started = Date.now();
  for (const order of (data ?? []) as MarketplaceOrder[]) {
    if (Date.now() - started > 12_000) break;
    if (order.stripe_checkout_session_id) {
      const session = await getMarketplaceStripe().checkout.sessions.retrieve(order.stripe_checkout_session_id);
      const id = objectId(session.payment_intent);
      if (session.payment_status === "paid" && id) {
        const intent = await getMarketplaceStripe().paymentIntents.retrieve(id);
        const chargeId = objectId(intent.latest_charge);
        if (chargeId) {
          const charge = await getMarketplaceStripe().charges.retrieve(chargeId);
          // Unique per observation; current state is re-read on every maintenance pass.
          await synchronizeMarketplaceCharge(charge, `reconcile:${createHash("sha256").update(`${chargeId}:${Date.now()}`).digest("hex")}`);
        }
      } else if (session.status === "expired") await rpc("birdshop_expire_marketplace_checkout", { p_order: order.id });
    } else if (Date.parse(order.checkout_expires_at) < Date.now()) {
      // Unknown create outcome: do not release stock or create another session. Search metadata
      // by listing all sessions for this short time window, including paid/expired ones.
      let matched = false;
      for await (const session of getMarketplaceStripe().checkout.sessions.list({
        created: { gte: Math.floor(Date.parse(order.checkout_expires_at) / 1000) - 32 * 60,
          lte: Math.floor(Date.parse(order.checkout_expires_at) / 1000) }, limit: 100,
      })) {
        if (session.metadata?.birdshop_marketplace_order_id !== order.id) continue;
        const saved = await db.from("birdshop_marketplace_orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
        if (saved.error) throw new Error("Unable to recover marketplace Checkout.");
        matched = true; break;
      }
      if (!matched) await rpc("birdshop_expire_marketplace_checkout", { p_order: order.id });
    }
    const checked = await db.from("birdshop_marketplace_orders").update({ stripe_reconciled_at: new Date().toISOString() }).eq("id", order.id);
    if (checked.error) throw new Error("Could not save marketplace reconciliation checkpoint.");
  }
}
// Kept separate from the existing first-party payment webhook secret.
export function connectWebhookSecret() { return env("STRIPE_CONNECT_WEBHOOK_SECRET"); }

/** Expire the processor session before restoring stock; verify buyer ownership on every call. */
export async function cancelMarketplaceCheckout(orderId: string, buyerId: string) {
  if (!isUuid(orderId)) throw new Error("Invalid marketplace order.");
  const db = createAdminClient();
  const { data: order, error } = await db.from("birdshop_marketplace_orders").select("*")
    .eq("id", orderId).eq("buyer_user_id", buyerId).single();
  if (error || !order || order.state !== "payment_pending") throw new Error("This unpaid order does not belong to you.");
  if (!order.stripe_checkout_session_id)
    throw new Error("Stripe is still confirming this checkout. It will expire automatically; please refresh shortly.");
  let session = await getMarketplaceStripe().checkout.sessions.retrieve(order.stripe_checkout_session_id);
  if (session.payment_status === "paid" || session.status === "complete") throw new Error("This payment has already completed. Refresh your orders.");
  if (session.status === "open") session = await getMarketplaceStripe().checkout.sessions.expire(session.id);
  if (session.status !== "expired") throw new Error("Stripe has not confirmed cancellation. Please try again.");
  await rpc("birdshop_expire_marketplace_checkout", { p_order: orderId });
}
