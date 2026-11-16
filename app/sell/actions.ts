"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARKETPLACE_CATEGORIES, requireMarketplaceUser, sellerSlug } from "@/lib/marketplace";

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 320;

export async function sendSellerLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!validEmail(email)) redirect("/sell?notice=invalid-email");

  const client = await createClient();
  const origin = (process.env.BIRDSHOP_SITE_URL || "https://birdshop.store").replace(/\/$/, "");
  const { error } = await client.auth.signInWithOtp({
    email, options: { shouldCreateUser: true, emailRedirectTo: origin + "/sell/auth/callback" },
  });
  if (error) redirect("/sell?notice=login-unavailable");
  redirect("/sell?notice=check-email");
}

export async function verifySellerLoginCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();
  if (!validEmail(email) || !/^\d{6,8}$/.test(token))
    redirect("/sell?notice=invalid-code");
  const client = await createClient();
  const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error) redirect("/sell?notice=invalid-code");
  redirect("/sell");
}

export async function signOutSeller() {
  const client = await createClient();
  await client.auth.signOut();
  redirect("/sell");
}

export async function submitSellerApplication(formData: FormData) {
  const user = await requireMarketplaceUser();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const handle = sellerSlug(String(formData.get("handle") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const categories = [...new Set(formData.getAll("categories").map(x => String(x)))];
  const payoutPreference = String(formData.get("payout_preference") ?? "");

  if (businessName.length < 3 || businessName.length > 90 ||
      !/^[a-z0-9][a-z0-9-]{2,31}$/.test(handle) ||
      description.length < 30 || description.length > 1500 ||
      categories.length < 1 || categories.length > 8 ||
      categories.some(category => !(MARKETPLACE_CATEGORIES as readonly string[]).includes(category)) ||
      !["bank","paypal","provider_to_be_approved"].includes(payoutPreference)) {
    redirect("/sell?notice=invalid-application");
  }

  const db = createAdminClient();
  const { data: existing, error: lookupError } = await db.from("birdshop_seller_applications")
    .select("id,status").eq("user_id",user.id).maybeSingle();
  if (lookupError) throw new Error("Seller applications are not ready. Please retry.");

  const { data: reserved } = await db.from("birdshop_seller_profiles")
    .select("id").eq("handle",handle).maybeSingle();
  if (reserved) redirect("/sell?notice=handle-taken");

  const payload = {
    contact_email: user.email!.toLowerCase(),
    business_name: businessName,
    requested_handle: handle,
    description,
    categories,
    payout_preference: payoutPreference,
    status: "pending",
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    updated_at: new Date().toISOString(),
  };
  if (existing && existing.status !== "rejected")
    redirect("/sell?notice=already-applied");

  const result = existing
    ? await db.from("birdshop_seller_applications")
      .update(payload).eq("id",existing.id).eq("user_id",user.id).eq("status","rejected").select("id").maybeSingle()
    : await db.from("birdshop_seller_applications")
      .insert({ ...payload, user_id:user.id }).select("id").maybeSingle();

  if (result.error || !result.data) {
    if (result.error?.code === "23505") redirect("/sell?notice=handle-taken");
    throw new Error("Your application could not be saved. Please try again.");
  }

  // Audit is best effort; the application status itself is authoritative.
  await db.from("birdshop_marketplace_audit").insert({
    entity_type:"seller_application",entity_id:result.data.id,actor_id:user.id,
    action:"submitted",details:{handle},
  });
  revalidatePath("/sell");
  revalidatePath("/admin/resellers");
  redirect("/sell?notice=application-submitted");
}
