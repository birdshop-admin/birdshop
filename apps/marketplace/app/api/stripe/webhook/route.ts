import type Stripe from "stripe";
import { getMarketplaceStripe } from "@/lib/stripe";
import { env, readBody } from "@/lib/server-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { processMarketplaceStripeEvent } from "@/lib/marketplace-payments";
export const runtime = "nodejs";
export const maxDuration = 60;
const supported = new Set(["checkout.session.completed","checkout.session.expired","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed",
  "charge.refunded","charge.updated","charge.succeeded","refund.created","refund.updated","refund.failed",
  "charge.dispute.created","charge.dispute.updated","charge.dispute.closed","charge.dispute.funds_withdrawn","charge.dispute.funds_reinstated","radar.early_fraud_warning.created"]);
export async function POST(request:Request) {
  let event:Stripe.Event;
  try {
    const signature=request.headers.get("stripe-signature");
    if(!signature)return Response.json({error:"Missing signature."},{status:400});
    event=getMarketplaceStripe().webhooks.constructEvent(await readBody(request,1048576),signature,env("STRIPE_MARKETPLACE_WEBHOOK_SECRET"));
    if(event.livemode)return Response.json({error:"Marketplace accepts sandbox events only."},{status:400});
  }catch{return Response.json({error:"Invalid marketplace webhook signature or configuration."},{status:400});}
  if(!supported.has(event.type))return Response.json({received:true});
  try {
    const handled=await processMarketplaceStripeEvent(event);
    if(handled){
      const {error}=await createAdminClient().from("birdshop_marketplace_webhook_events").upsert({
        id:event.id,type:event.type,processed_at:new Date().toISOString(),
      },{onConflict:"id"});
      if(error)throw new Error("Could not acknowledge marketplace event.");
    }
    return Response.json({received:true});
  }catch{return Response.json({error:"Marketplace event reconciliation failed; retry required."},{status:500});}
}
