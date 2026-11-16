import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createAdminClient } from "@/lib/supabase/admin";
import { marketplaceMoney,type SellerProfile,type MarketplaceListing } from "@/lib/marketplace";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic="force-dynamic";

export default async function SellerStorefront({params}:{params:Promise<{handle:string}>}){
  const {handle}=await params;
  if(!/^[a-z0-9][a-z0-9-]{2,31}$/.test(handle))notFound();
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_seller_profiles")
    .select("id,user_id,handle,display_name,description,logo_url,status,commission_bps")
    .eq("handle",handle).eq("status","active").maybeSingle();
  if(error||!data)notFound();
  const seller=data as SellerProfile;
  const result=await db.from("birdshop_marketplace_listings")
    .select("id,seller_id,slug,title,description,listing_type,category,image_url,price_cents,stock,fulfillment_method,delivery_hours,status,created_at")
    .eq("seller_id",seller.id).eq("status","published").order("created_at",{ascending:false}).limit(100);
  if(result.error)throw new Error("Seller listings are temporarily unavailable.");
  const listings=(result.data||[]) as MarketplaceListing[];

  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">
    <SiteHeader/>
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / APPROVED SELLER</span>
        <h1>{seller.display_name}</h1>
        <p>{seller.description||"This seller has not written a storefront description yet."}</p>
        <div className={styles.actions}>
          <Link className={styles.outline} href="/marketplace">Back to marketplace</Link>
        </div>
      </header>
      <div className={styles.stack}>
        <div className={styles.card}>
          <h2>Seller information</h2>
          <p>Storefront: <strong>@{seller.handle}</strong> · Owner-approved seller account</p>
          <p>Customer ratings are only shown when based on verified marketplace transactions. No ratings are available yet.</p>
        </div>
        <section aria-label="Seller listings">
          <h2 style={{font:"italic 37px Georgia,serif"}}>Available listings</h2>
          {!listings.length&&<div className={styles.card}><p>No listings published by this seller yet.</p></div>}
          <div className={styles.grid}>
            {listings.map(listing=><article key={listing.id} className={styles.card}>
              {listing.image_url?
                <div role="img" aria-label={listing.title} className={styles.thumb}
                  style={{backgroundImage:`linear-gradient(0deg,#0008,transparent),url("${listing.image_url}")`,backgroundPosition:"center",backgroundSize:"cover"}}/>
                :<div className={styles.thumb} aria-hidden="true"/>}
              <p className={styles.meta}>{listing.category} / {listing.listing_type.replace("_"," ")}</p>
              <h3 className={styles.itemTitle}>{listing.title}</h3>
              <p style={{whiteSpace:"pre-wrap"}}>{listing.description}</p>
              <p className={styles.price}>{marketplaceMoney(listing.price_cents)}</p>
              <p className={styles.small}>{listing.stock} available · Estimated delivery {listing.delivery_hours}h</p>
              <Link className={styles.button} href={`/marketplace/inquire/${listing.id}`}>Ask seller about this listing</Link>
            </article>)}
          </div>
        </section>
        <div className={styles.card}>
          <h2>Ordering</h2>
          <p>Marketplace purchases are not enabled yet. Please use the inquiry feature for product questions only; don't send off-platform payments or sensitive account details.</p>
        </div>
      </div>
    </div>
    <SiteFooter/>
  </main>;
}
