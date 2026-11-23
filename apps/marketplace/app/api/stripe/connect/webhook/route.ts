import type Stripe from "stripe";
import { getMarketplaceStripe } from "@/lib/stripe";
import { CONNECT_EVENT_TYPES, refreshSellerConnect, type ConnectMapping } from "@/lib/stripe-connect";
import { connectWebhookSecret } from "@/lib/marketplace-payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/server-config";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let event: Stripe.V2.Core.EventNotification;
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
    event = getMarketplaceStripe().parseEventNotification(await readBody(request, 1048576), signature, connectWebhookSecret());
  } catch { return Response.json({ error: "Invalid Connect webhook signature or configuration." }, { status: 400 }); }
  if (!CONNECT_EVENT_TYPES.has(event.type) || !("related_object" in event) || !("id" in event.related_object)) return Response.json({ received: true });
  try {
    const { data, error } = await createAdminClient().from("birdshop_seller_connect_accounts")
      .select("*").eq("stripe_account_id", event.related_object.id).maybeSingle();
    if (error) throw error;
    // Stripe emits platform events for unrelated accounts too. Never create a mapping from metadata.
    if (data) await refreshSellerConnect(data as ConnectMapping);
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Connect status refresh failed; retry required." }, { status: 500 }); }
}
