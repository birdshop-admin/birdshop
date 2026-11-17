import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { marketplaceMoney, requireMarketplaceUser } from "@/lib/marketplace";
import { isUuid } from "@/lib/server-config";
import { marketplaceCheckoutEnabled } from "@/lib/marketplace-payments";
import { checkoutMarketplaceListing } from "../actions";
import styles from "@/app/marketplace/marketplace.module.css";
export const dynamic = "force-dynamic";
export default async function MarketplaceCheckout({ params }: { params: Promise<{ id: string }> }) {
  await requireMarketplaceUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: listing, error } = await createAdminClient().from("birdshop_marketplace_listings")
    .select("id,title,price_cents,stock,seller_id,delivery_hours,birdshop_seller_profiles!inner(display_name,status)")
    .eq("id", id).eq("status", "published").eq("birdshop_seller_profiles.status", "active").single();
  if (error || !listing) notFound();
  return <main id="site-content" className={`page-shell bs-editorial-page ${styles.shell}`}>
    <div className={styles.wrap}>
      <header className={styles.hero}><span className={styles.eyebrow}>BIRDSHOP / CHECKOUT</span>
        <h1>Review your order.</h1><p>Secure checkout with Stripe. Track delivery and contact your seller through BirdShop.</p></header>
      <section className={`${styles.card} ${styles.stack}`}>
        <span className={styles.status}>Sandbox · test payments only</span>
        <h2>{listing.title}</h2><p className={styles.price}>{marketplaceMoney(listing.price_cents)} per unit</p>
        <p>Estimated delivery {listing.delivery_hours} hours. The seller fulfills this order through BirdShop.</p>
        <form action={checkoutMarketplaceListing}>
          <input type="hidden" name="listing_id" value={listing.id}/>
          <input type="hidden" name="checkout_key" value={randomUUID()}/>
          <label className={styles.label} htmlFor="quantity">Quantity</label>
          <input className={styles.field} style={{maxWidth:140}} id="quantity" name="quantity" type="number" min="1"
            max={Math.min(10, listing.stock)} defaultValue={1} required/>
          <p>The total is confirmed on Stripe before you pay.</p>
          <button className={styles.button} disabled={!marketplaceCheckoutEnabled() || listing.stock<1}>
            {marketplaceCheckoutEnabled() ? "Continue to secure checkout" : "Sandbox checkout is not enabled"}</button>
        </form>
        <Link href="/marketplace" className={styles.outline}>Continue browsing</Link>
      </section>
    </div>
  </main>;
}
