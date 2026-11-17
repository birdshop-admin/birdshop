"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function closeOwnerMarketplaceThread(form:FormData){
  const {user}=await requireOwner();
  const id=String(form.get("thread_id")||"");
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))
    throw new Error("Invalid conversation ID.");
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_marketplace_threads")
    .update({status:"closed",updated_at:new Date().toISOString()})
    .eq("id",id).eq("status","open").select("id").maybeSingle();
  if(error||!data)throw new Error("This conversation cannot be closed.");
  await db.from("birdshop_marketplace_audit").insert({
    entity_type:"marketplace_thread",entity_id:id,actor_id:user.id,
    action:"owner_closed",
  });
  revalidatePath("/admin/resellers/inquiries");
  revalidatePath("/admin/resellers/inquiries/"+id);
  revalidatePath("/marketplace/messages/"+id);
}
