"use server";
import { redirect } from "next/navigation";
import { requireApprovedSeller } from "@/lib/marketplace";
import { rateLimit } from "@/lib/rate-limit";
import { createSellerAccountLink, ensureSellerConnect, getSellerConnect } from "@/lib/stripe-connect";
export async function onboardSellerConnect(form: FormData) {
  const { profile, user } = await requireApprovedSeller();
  await rateLimit("seller-connect-onboarding", user.id, 12, 3600);
  const existing = await getSellerConnect(profile.id);
  const country = existing?.country ?? String(form.get("country") ?? "");
  const mapping = await ensureSellerConnect(profile.id, user.id, user.email!, country);
  redirect(await createSellerAccountLink(mapping));
}
