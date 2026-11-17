"use server";

import { cancelMarketplaceCheckout } from "@/lib/marketplace-payments";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/staff-auth";
import { requireMarketplaceUser, requireApprovedSeller } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const uuid = (value:string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
type MarketplaceActor = "buyer" | "seller" | "owner";
type OrderState = "payment_pending" | "paid" | "fulfillment_pending" |
  "delivered" | "buyer_confirmed" | "completed" | "disputed" |
  "refunded" | "cancelled";

async function transition(
  orderId:string, previous:OrderState, next:OrderState,
  actorId:string, actorRole:MarketplaceActor, note=""
){
  if(!uuid(orderId) || note.length > 3000)
    throw new Error("Invalid order transition.");
  const db=createAdminClient();
  const {error}=await db.rpc("birdshop_marketplace_transition_order",{
    p_order_id:orderId,p_expected_state:previous,p_next_state:next,
    p_actor_id:actorId,p_actor_role:actorRole,
    p_event_key:"market:"+randomUUID(),p_note:note,
  });
  if(error)throw new Error("Order state could not be updated. Refresh and confirm the payment/fulfillment status.");
  revalidatePath("/marketplace/orders");
  revalidatePath("/sell/orders");
  revalidatePath("/admin/resellers/orders");
  revalidatePath("/admin/resellers/disputes");
}

export async function buyerConfirmMarketplaceDelivery(form:FormData){
  const user=await requireMarketplaceUser();
  const id=String(form.get("order_id")||"");
  await rateLimit("marketplace-confirm",user.id,12,3600);
  await transition(id,"delivered","buyer_confirmed",user.id,"buyer");
}

export async function buyerCancelUnpaidMarketplaceOrder(form:FormData){
  const user=await requireMarketplaceUser();
  const id=String(form.get("order_id")||"");
  await rateLimit("marketplace-cancel",user.id,12,3600);
  if(!uuid(id))throw new Error("Invalid order ID.");
  const {data:order,error}=await createAdminClient().from("birdshop_marketplace_orders")
    .select("checkout_key").eq("id",id).eq("buyer_user_id",user.id).single();
  if(error||!order)throw new Error("Order not found.");
  if(order.checkout_key){
    await cancelMarketplaceCheckout(id,user.id);
    revalidatePath("/marketplace/orders");
    revalidatePath("/sell/orders");
  }else await transition(id,"payment_pending","cancelled",user.id,"buyer");
}

export async function sellerBeginMarketplaceFulfillment(form:FormData){
  const {user}=await requireApprovedSeller();
  const id=String(form.get("order_id")||"");
  await transition(id,"paid","fulfillment_pending",user.id,"seller");
}

export async function sellerMarkMarketplaceDelivered(form:FormData){
  const {user}=await requireApprovedSeller();
  const id=String(form.get("order_id")||"");
  const note=String(form.get("delivery_note")||"").trim();
  if(note.length<5||note.length>3000)
    throw new Error("Add a delivery description (5–3,000 characters).");
  await transition(id,"fulfillment_pending","delivered",user.id,"seller",note);
}

export async function buyerOpenMarketplaceDispute(form:FormData){
  const user=await requireMarketplaceUser();
  const id=String(form.get("order_id")||"");
  const reason=String(form.get("reason")||"").trim();
  if(!uuid(id)||reason.length<10||reason.length>3000)
    throw new Error("Enter a valid dispute reason (10–3,000 characters).");
  await rateLimit("marketplace-dispute",user.id,5,3600);
  const db=createAdminClient();
  const {error}=await db.rpc("birdshop_marketplace_open_dispute",{
    p_order_id:id,p_buyer_id:user.id,p_reason:reason,
    p_event_key:"dispute:"+randomUUID(),
  });
  if(error)throw new Error("Unable to open a dispute on this order. Review its current status.");
  revalidatePath("/marketplace/orders");
  revalidatePath("/admin/resellers/disputes");
  revalidatePath("/sell/orders");
}

export async function ownerCompleteMarketplaceOrder(form:FormData){
  const {user}=await requireOwner();
  const id=String(form.get("order_id")||"");
  await transition(id,"buyer_confirmed","completed",user.id,"owner");
}

export async function ownerReleaseMarketplaceEarnings(form:FormData){
  const {user}=await requireOwner();
  const id=String(form.get("order_id")||"");
  if(!uuid(id))throw new Error("Invalid order ID.");
  const {error}=await createAdminClient().rpc("birdshop_marketplace_release_earnings",{
    p_order_id:id,p_owner_id:user.id,
  });
  if(error)throw new Error("Earnings cannot be released; check the hold date, dispute and refund state.");
  revalidatePath("/admin/resellers/orders");
  revalidatePath("/sell/dashboard");
}

export async function ownerReviewMarketplaceDispute(form:FormData){
  const {user}=await requireOwner();
  const id=String(form.get("dispute_id")||"");
  if(!uuid(id))throw new Error("Invalid dispute ID.");
  const db=createAdminClient();
  // No owner "resolve and pay" shortcut: funds are held until actual
  // provider-confirmed settlement and approved dispute decisions exist.
  const {data,error}=await db.from("birdshop_marketplace_disputes")
    .update({status:"under_review"}).eq("id",id).eq("status","open")
    .select("id").maybeSingle();
  if(error||!data)throw new Error("Dispute is no longer open.");
  const audit=await db.from("birdshop_marketplace_audit").insert({
    entity_type:"marketplace_dispute",entity_id:id,
    actor_id:user.id,action:"review_started",
  });
  if(audit.error)throw new Error("Dispute review was saved but the audit failed; notify the owner before proceeding.");
  revalidatePath("/admin/resellers/disputes");
}
