"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMarketplaceUser } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

async function checkParticipant(userId:string,threadId:string){
  const db=createAdminClient();
  const {data:thread,error}=await db.from("birdshop_marketplace_threads")
    .select("id,buyer_user_id,seller_id,status").eq("id",threadId).maybeSingle();
  if(error||!thread)throw new Error("Conversation not found.");
  const {data:seller}=await db.from("birdshop_seller_profiles")
    .select("user_id,status").eq("id",thread.seller_id).maybeSingle();
  const isBuyer=thread.buyer_user_id===userId;
  const isSeller=seller?.user_id===userId && seller.status==="active";
  if(!isBuyer&&!isSeller)throw new Error("You cannot access this conversation.");
  return {thread,isBuyer,isSeller,db};
}

export async function createMarketplaceInquiry(form:FormData){
  const user=await requireMarketplaceUser();
  const listingId=String(form.get("listing_id")||"");
  const message=String(form.get("message")||"").trim();
  if(!isUuid(listingId)||message.length<10||message.length>4000)
    throw new Error("Enter a message between 10 and 4,000 characters.");
  await rateLimit("marketplace-inquiry",user.id,5,3600);
  const db=createAdminClient();
  const {data:listing,error:listingError}=await db.from("birdshop_marketplace_listings")
    .select("id,seller_id,status").eq("id",listingId).eq("status","published").maybeSingle();
  if(listingError||!listing)throw new Error("The listing is no longer available.");
  const {data:seller}=await db.from("birdshop_seller_profiles")
    .select("id,user_id,status").eq("id",listing.seller_id).maybeSingle();
  if(!seller||seller.status!=="active"||seller.user_id===user.id)
    throw new Error("You cannot start an inquiry with this seller.");
  const {data:originalThread,error:threadError}=await db.from("birdshop_marketplace_threads")
    .select("id,status").eq("buyer_user_id",user.id).eq("listing_id",listingId).maybeSingle();
  if(threadError)throw new Error("Could not look up existing inquiry.");
  let thread=originalThread;
  if(!thread){
    const inserted=await db.from("birdshop_marketplace_threads")
      .insert({buyer_user_id:user.id,seller_id:listing.seller_id,listing_id:listingId})
      .select("id,status").single();
    if(inserted.error){
      // Unique constraint prevents simultaneous duplicate conversations.
      const again=await db.from("birdshop_marketplace_threads").select("id,status")
        .eq("buyer_user_id",user.id).eq("listing_id",listingId).maybeSingle();
      if(again.error||!again.data)throw new Error("Inquiry could not be opened.");
      thread=again.data;
    } else thread=inserted.data;
  }
  if(!thread||thread.status!=="open")throw new Error("This conversation has been closed.");
  const {error:messageError}=await db.from("birdshop_marketplace_messages")
    .insert({thread_id:thread.id,sender_user_id:user.id,body:message});
  if(messageError)throw new Error("Inquiry message could not be saved.");
  await db.from("birdshop_marketplace_threads")
    .update({updated_at:new Date().toISOString()}).eq("id",thread.id);
  revalidatePath("/sell/inbox");
  redirect("/marketplace/messages/"+thread.id);
}

export async function sendMarketplaceMessage(form:FormData){
  const user=await requireMarketplaceUser();
  const threadId=String(form.get("thread_id")||"");
  const body=String(form.get("message")||"").trim();
  if(!isUuid(threadId)||body.length<1||body.length>4000)
    throw new Error("Enter a message up to 4,000 characters.");
  await rateLimit("marketplace-message",user.id,25,3600);
  const {thread,db}=await checkParticipant(user.id,threadId);
  if(thread.status!=="open")throw new Error("This conversation is closed.");
  const {error}=await db.from("birdshop_marketplace_messages")
    .insert({thread_id:threadId,sender_user_id:user.id,body});
  if(error)throw new Error("Message was not saved.");
  await db.from("birdshop_marketplace_threads")
    .update({updated_at:new Date().toISOString()}).eq("id",threadId).eq("status","open");
  revalidatePath("/marketplace/messages/"+threadId);
  revalidatePath("/sell/inbox");
  revalidatePath("/marketplace/messages");
}

export async function closeMarketplaceThread(form:FormData){
  const user=await requireMarketplaceUser();
  const id=String(form.get("thread_id")||"");
  if(!isUuid(id))throw new Error("Invalid conversation.");
  const {thread,db}=await checkParticipant(user.id,id);
  if(thread.status!=="open")throw new Error("Conversation already closed.");
  const {error}=await db.from("birdshop_marketplace_threads")
    .update({status:"closed",updated_at:new Date().toISOString()})
    .eq("id",id).eq("status","open");
  if(error)throw new Error("Cannot close conversation.");
  revalidatePath("/marketplace/messages/"+id);
  revalidatePath("/sell/inbox");
}
