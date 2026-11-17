import "server-only";
import type { SellerTier } from "@/lib/seller-tiers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const MARKETPLACE_ACTIVE = false; // Production launch still requires a separate reviewed change.

export const MARKETPLACE_CATEGORIES = [
  "Deepwoken", "Grand Piece Online", "Slayers Unleashed",
  "Other Roblox", "Game Keys", "Digital Goods", "Other Games",
] as const;

export type SellerApplication = {
  id: string;
  user_id: string;
  business_name: string;
  requested_handle: string;
  description: string;
  categories: string[];
  payout_preference: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

export type SellerProfile = {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  description: string;
  logo_url: string | null;
  status: "active" | "suspended";
  commission_bps: number;
  earned_tier: SellerTier;
  partner_approved: boolean;
  commission_override_bps: number | null;
  qualifying_sales_cents: number;
};

export type MarketplaceListing = {
  id: string;
  seller_id: string;
  slug: string;
  title: string;
  description: string;
  listing_type: "digital_product" | "game_service";
  category: string;
  image_url: string | null;
  price_cents: number;
  stock: number;
  fulfillment_method: "seller_manual" | "service_scheduled";
  service_options: string[];
  delivery_hours: number;
  status: "draft" | "pending_review" | "published" | "paused" | "rejected" | "archived";
  created_at: string;
};

export async function getAuthenticatedMarketplaceUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error && (error.name === "AuthRetryableFetchError" || Number(error.status) >= 500))
    throw new Error("Authentication is temporarily unavailable.");
  return user?.email && user.email_confirmed_at ? user : null;
}

export async function requireMarketplaceUser() {
  const user = await getAuthenticatedMarketplaceUser();
  if (!user) redirect("/account?notice=sign-in-required");
  return user;
}

export async function getMySellerProfile(userId: string): Promise<SellerProfile | null> {
  const { data, error } = await createAdminClient()
    .from("birdshop_seller_profiles")
    .select("id,user_id,handle,display_name,description,logo_url,status,commission_bps,earned_tier,partner_approved,commission_override_bps,qualifying_sales_cents")
    .eq("user_id", userId).maybeSingle();
  if (error) throw new Error("The seller account is not available. Try again shortly.");
  return data as SellerProfile | null;
}

export async function requireApprovedSeller() {
  const user = await requireMarketplaceUser();
  const profile = await getMySellerProfile(user.id);
  if (!profile || profile.status !== "active") redirect("/sell?notice=application-required");
  return { user, profile };
}

export function sellerSlug(input: string) {
  return input.toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function marketplaceMoney(cents: number | string | null | undefined) {
  const amount = Number(cents ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(Number.isFinite(amount) ? amount / 100 : 0);
}

export function validMarketplaceUrl(value: string) {
  if (!value) return null;
  if (value.length > 1000) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString() : null;
  } catch { return null; }
}
