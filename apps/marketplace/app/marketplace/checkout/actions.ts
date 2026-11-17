"use server";
import { redirect } from "next/navigation";
import { requireMarketplaceUser } from "@/lib/marketplace";
import { rateLimit } from "@/lib/rate-limit";
import { startMarketplaceCheckout } from "@/lib/marketplace-payments";
export async function checkoutMarketplaceListing(form: FormData) {
  const user = await requireMarketplaceUser();
  await rateLimit("marketplace-checkout", user.id, 20, 3600);
  const url = await startMarketplaceCheckout(user.id, String(form.get("listing_id") ?? ""),
    Number(form.get("quantity")), String(form.get("checkout_key") ?? ""));
  redirect(url);
}
