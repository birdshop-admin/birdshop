import { requireApprovedSeller } from "@/lib/marketplace";
import { getSellerConnect, createSellerAccountLink } from "@/lib/stripe-connect";
import { rateLimit } from "@/lib/rate-limit";
import { privateHeaders, siteUrl } from "@/lib/server-config";
export const runtime = "nodejs";
export async function GET() {
  const { profile, user } = await requireApprovedSeller();
  await rateLimit("seller-connect-refresh", user.id, 20, 3600);
  const mapping = await getSellerConnect(profile.id);
  if (!mapping?.stripe_account_id) return Response.redirect(`${siteUrl()}/sell/dashboard`, 303);
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: await createSellerAccountLink(mapping) } });
}
