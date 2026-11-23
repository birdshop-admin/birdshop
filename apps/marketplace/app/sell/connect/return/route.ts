import { requireApprovedSeller } from "@/lib/marketplace";
import { getSellerConnect, refreshSellerConnect } from "@/lib/stripe-connect";
import { privateHeaders, siteUrl } from "@/lib/server-config";
export const runtime = "nodejs";
export async function GET() {
  const { profile } = await requireApprovedSeller();
  const mapping = await getSellerConnect(profile.id);
  // A return URL is not proof of completed onboarding. Retrieve actual Stripe requirements.
  if (mapping?.stripe_account_id) await refreshSellerConnect(mapping);
  return new Response(null, { status: 303, headers: { ...privateHeaders,
    Location: `${siteUrl()}/sell/dashboard?notice=connect-returned` } });
}
