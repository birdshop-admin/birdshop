"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function reviewSellerApplication(form:FormData){
  const {user}=await requireOwner();
  const id=String(form.get("id")||"");
  const action=String(form.get("action")||"");
  const note=String(form.get("note")||"").trim();
  if(!isUuid(id)||!["approved","rejected"].includes(action)||note.length>1000)
    throw new Error("Invalid seller approval request.");
  const db=createAdminClient();
  const {error}=await db.rpc("birdshop_review_seller_application",{
    p_id:id,p_action:action,p_owner:user.id,p_note:note,
  });
  if(error)throw new Error("Application review failed. Check the shop handle and current status.");
  revalidatePath("/admin/resellers");
  revalidatePath("/sell");
  revalidatePath("/marketplace");
}

export async function updateSellerStatus(form:FormData){
  const {user}=await requireOwner();
  const sellerId=String(form.get("seller_id")||"");
  const status=String(form.get("status")||"");
  if(!isUuid(sellerId)||!["active","suspended"].includes(status))
    throw new Error("Invalid seller state.");
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_seller_profiles")
    .update({status,updated_at:new Date().toISOString()})
    .eq("id",sellerId).neq("status",status).select("id").maybeSingle();
  if(error||!data)throw new Error("The seller status was not changed.");
  await db.from("birdshop_marketplace_audit").insert({
    entity_type:"seller",entity_id:sellerId,actor_id:user.id,action:status,
  });
  revalidatePath("/admin/resellers");
  revalidatePath("/marketplace");
}

export async function setSellerCommission(form:FormData){
  const {user}=await requireOwner();
  const sellerId=String(form.get("seller_id")||"");
  const raw=String(form.get("commission_percentage")??"").trim();
  const percentage=Number(raw);
  const partner=form.get("partner_approved")==="on";
  if(!isUuid(sellerId)||(raw!==""&&(!/^\d{1,2}(\.\d{1,2})?$/.test(raw)||percentage<0||percentage>50)))
    throw new Error("Commission must be blank for tier pricing or between 0 and 50%, with at most two decimals.");
  const {error}=await createAdminClient().rpc("birdshop_owner_seller_pricing",{
    p_owner:user.id,p_seller:sellerId,p_partner:partner,
    p_override:raw===""?null:Math.round(percentage*100),
  });
  if(error)throw new Error("Unable to change seller pricing. Owner approval is required.");
  revalidatePath("/sell/dashboard");
  revalidatePath("/admin/resellers");
}

export async function moderateSellerListing(form:FormData){
  const {user}=await requireOwner();
  const id=String(form.get("listing_id")||"");
  const status=String(form.get("status")||"");
  const reason=String(form.get("reason")||"").trim();
  if(!isUuid(id)||!["published","rejected","paused"].includes(status)||
      reason.length>1000)throw new Error("Invalid listing review.");
  const db=createAdminClient();
  const {data:listing,error:lookupError}=await db.from("birdshop_marketplace_listings")
    .select("id,seller_id,status,stock").eq("id",id).maybeSingle();
  if(lookupError||!listing)throw new Error("Listing not found.");
  if(status==="published"){
    if(listing.status!=="pending_review"||listing.stock<1)
      throw new Error("Only an in-stock listing awaiting review can be published.");
    const {data:seller}=await db.from("birdshop_seller_profiles")
      .select("status").eq("id",listing.seller_id).single();
    if(seller?.status!=="active")throw new Error("Seller must be active.");
  } else if (status==="rejected" && listing.status!=="pending_review"){
    throw new Error("Only submitted listings can be rejected.");
  } else if (status==="paused" && listing.status!=="published"){
    throw new Error("Only published listings can be paused.");
  }
  const {data,error}=await db.from("birdshop_marketplace_listings")
    .update({status,moderated_by:user.id,moderated_at:new Date().toISOString(),
      rejection_reason:status==="rejected"?reason:null,
      updated_at:new Date().toISOString()})
    .eq("id",id).eq("status",listing.status).select("id").maybeSingle();
  if(error||!data)throw new Error("Listing state changed. Refresh and try again.");
  await db.from("birdshop_marketplace_audit").insert({
    entity_type:"listing",entity_id:id,actor_id:user.id,action:status,
    details:{reason:status==="rejected"?reason:""},
  });
  revalidatePath("/admin/resellers");
  revalidatePath("/marketplace");
  revalidatePath("/sell/dashboard");
}
