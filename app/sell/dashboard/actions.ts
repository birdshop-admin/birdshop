"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MARKETPLACE_CATEGORIES, requireApprovedSeller,
  sellerSlug, validMarketplaceUrl
} from "@/lib/marketplace";

const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const stringValue=(form:FormData,key:string)=>String(form.get(key)??"").trim();

export async function saveMarketplaceListing(form:FormData){
  const {user,profile}=await requireApprovedSeller();
  const id=stringValue(form,"id");
  if(id && !uuid(id)) throw new Error("Invalid listing ID.");

  const title=stringValue(form,"title");
  const description=stringValue(form,"description");
  const listing_type=stringValue(form,"listing_type");
  const category=stringValue(form,"category");
  const imageInput=stringValue(form,"image_url");
  const image_url=validMarketplaceUrl(imageInput);
  const price=Number(stringValue(form,"price"));
  const price_cents=Math.round(price*100);
  const stock=Number(stringValue(form,"stock"));
  const delivery_hours=Number(stringValue(form,"delivery_hours"));

  if(title.length<3||title.length>120||
    description.length<20||description.length>3000||
    !["digital_product","game_service"].includes(listing_type)||
    !(MARKETPLACE_CATEGORIES as readonly string[]).includes(category)||
    (imageInput && !image_url)||
    !Number.isFinite(price)||price<.5||price>999999.99||
    Math.abs(price*100-price_cents)>.00001||
    !Number.isInteger(stock)||stock<0||stock>10000||
    !Number.isInteger(delivery_hours)||delivery_hours<1||delivery_hours>720)
    throw new Error("Check the listing title, category, image URL, price, stock and delivery time.");

  const db=createAdminClient();
  const values={
    title,description,listing_type,category,image_url,price_cents,stock,delivery_hours,
    fulfillment_method:listing_type==="digital_product"?"seller_manual":"service_scheduled",
    status:"draft",moderated_by:null,moderated_at:null,rejection_reason:null,
    updated_at:new Date().toISOString(),
  };
  let listingId:string;
  if(id){
    const {data,error}=await db.from("birdshop_marketplace_listings")
      .update(values).eq("id",id).eq("seller_id",profile.id).select("id").maybeSingle();
    if(error||!data)throw new Error("Unable to edit this listing. Check ownership and try again.");
    listingId=data.id;
  } else {
    const slug=sellerSlug(profile.handle+"-"+title).slice(0,99)+
      "-"+randomBytes(4).toString("hex");
    const {data,error}=await db.from("birdshop_marketplace_listings")
      .insert({...values,slug,seller_id:profile.id}).select("id").single();
    if(error||!data)throw new Error("Unable to create seller listing.");
    listingId=data.id;
  }
  await db.from("birdshop_marketplace_audit").insert({
    entity_type:"listing",entity_id:listingId,actor_id:user.id,action:id?"edited":"created",
  });
  revalidatePath("/sell/dashboard");
  revalidatePath("/marketplace");
  redirect("/sell/dashboard?notice=listing-saved");
}

export async function changeMyListingState(form:FormData){
  const {user,profile}=await requireApprovedSeller();
  const id=stringValue(form,"id");
  const action=stringValue(form,"action");
  if(!uuid(id)||!["submit","pause"].includes(action))throw new Error("Invalid listing action.");
  const db=createAdminClient();
  const {data:listing,error:lookupError}=await db.from("birdshop_marketplace_listings")
    .select("id,status,stock").eq("id",id).eq("seller_id",profile.id).maybeSingle();
  if(lookupError||!listing)throw new Error("Listing not found.");
  const canSubmit=["draft","rejected","paused"].includes(listing.status)&&listing.stock>0;
  const canPause=listing.status==="published";
  if(action==="submit"&&!canSubmit||action==="pause"&&!canPause)
    throw new Error("This listing cannot be changed from its current state.");
  const status=action==="submit"?"pending_review":"paused";
  const {data,error}=await db.from("birdshop_marketplace_listings")
    .update({status,updated_at:new Date().toISOString()})
    .eq("id",id).eq("seller_id",profile.id).eq("status",listing.status)
    .select("id").maybeSingle();
  if(error||!data)throw new Error("Listing changed. Refresh and retry.");
  await db.from("birdshop_marketplace_audit").insert({
    entity_type:"listing",entity_id:id,actor_id:user.id,action:status,
  });
  revalidatePath("/sell/dashboard");
  revalidatePath("/admin/resellers");
  revalidatePath("/marketplace");
}

export async function updateMyShop(form:FormData){
  const {user,profile}=await requireApprovedSeller();
  const display_name=stringValue(form,"display_name");
  const description=stringValue(form,"description");
  const imageInput=stringValue(form,"logo_url");
  const logo_url=validMarketplaceUrl(imageInput);
  if(display_name.length<3||display_name.length>90||description.length>1500||
      (imageInput&&!logo_url))
    throw new Error("Invalid storefront details.");
  const db=createAdminClient();
  const {error}=await db.from("birdshop_seller_profiles")
    .update({display_name,description,logo_url,updated_at:new Date().toISOString()})
    .eq("id",profile.id).eq("user_id",user.id).eq("status","active");
  if(error)throw new Error("Could not save shop details.");
  revalidatePath("/sell/dashboard");
  revalidatePath("/shops/"+profile.handle);
}
