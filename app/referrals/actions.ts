"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 320;
const validName = (v: string) => v.length >= 2 && v.length <= 80;

export async function sendReferralLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!validEmail(email)) redirect("/referrals?notice=invalid-email");

  const client = await createClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${process.env.BIRDSHOP_SITE_URL?.replace(/\/$/, "") ?? ""}/referrals/auth/callback`,
    },
  });
  // Do not tell a browser whether an email exists.
  if (error) {
    console.error("Referral login request failed", { code: error.code });
    redirect("/referrals?notice=email-unavailable");
  }
  redirect("/referrals?notice=check-email");
}

export async function verifyReferralCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();
  if (!validEmail(email) || !/^\d{6,8}$/.test(token))
    redirect("/referrals?notice=invalid-code");
  const client = await createClient();
  const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error) redirect("/referrals?notice=invalid-code");
  redirect("/referrals");
}

export async function registerMyReferral(formData: FormData) {
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user?.email || !user.email_confirmed_at)
    redirect("/referrals?notice=sign-in-required");

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "customer");
  if (!validName(name) || !["customer","affiliate"].includes(kind))
    redirect("/referrals?notice=invalid-registration");

  const email = user.email.trim().toLowerCase();
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin.from("birdshop_referrers")
    .select("id").eq("contact_email", email).maybeSingle();
  if (lookupError) throw new Error("Unable to check referral registration.");
  if (existing) redirect("/referrals?notice=already-registered");

  // Generated server-side. Collision retries avoid predictable user-selected codes.
  let success = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = "BS" + randomBytes(6).toString("hex").toUpperCase();
    const { error } = await admin.from("birdshop_referrers").insert({
      contact_email: email,
      display_name: name,
      code,
      kind,
      status: kind === "customer" ? "approved" : "pending",
      approved_at: kind === "customer" ? new Date().toISOString() : null,
    });
    if (!error) { success = true; break; }
    if (error.code !== "23505") throw new Error("Unable to register your referral.");
    // Duplicated email is not a reason to create another account.
    const { data: already } = await admin.from("birdshop_referrers")
      .select("id").eq("contact_email", email).maybeSingle();
    if (already) redirect("/referrals?notice=already-registered");
  }
  if (!success) throw new Error("Referral code generation could not finish.");
  revalidatePath("/referrals");
  redirect("/referrals?notice=registered");
}

export async function signOutReferral() {
  const client = await createClient();
  await client.auth.signOut();
  redirect("/referrals");
}
