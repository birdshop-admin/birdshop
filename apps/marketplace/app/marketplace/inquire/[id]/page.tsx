import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedMarketplaceUser, marketplaceMoney } from "@/lib/marketplace";
import { createMarketplaceInquiry } from "@/app/marketplace/messages/actions";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Ask a seller | BirdShop"};

export default async function MarketplaceInquiry({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  const db=createAdminClient();
  const {data:listing,error}=await db.from("birdshop_marketplace_listings")
    .select("id,title,description,price_cents,listing_type,seller_id,status").eq("id",id).eq("status","published").maybeSingle();
  if(error||!listing)notFound();
  const {data:seller}=await db.from("birdshop_seller_profiles")
    .select("handle,display_name,status").eq("id",listing.seller_id).eq("status","active").maybeSingle();
  if(!seller)notFound();
  const user=await getAuthenticatedMarketplaceUser();
  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">

    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / PRIVATE SELLER INQUIRY</span>
        <h1>Ask the seller.</h1>
        <p>Discuss details without sharing payment credentials or off-site payment information.</p>
      </header>
      <div className={styles.split} style={{marginTop:32}}>
        <section className={styles.card}>
          <h2>{listing.title}</h2>
          <p>Seller: <Link href={`/shops/${seller.handle}`}>{seller.display_name}</Link></p>
          <p>Listed price: <strong>{marketplaceMoney(listing.price_cents)}</strong></p>
          <p style={{whiteSpace:"pre-wrap"}}>{listing.description}</p>
          <p className={styles.notice}>Marketplace checkout is not enabled yet. This inquiry is for product questions, not for collecting payment or transferring account credentials.</p>
        </section>
        <section className={styles.card}>
          <h2>Start a conversation</h2>
          {!user?<><p>You must verify your email before messaging a seller.</p>
            <Link className={styles.button} href="/sell">Sign in with email</Link>
            <p className={styles.small}>After signing in, return to this listing and select Ask seller.</p>
          </>:<>
            <p>Signed in as <strong>{user.email}</strong></p>
            <form action={createMarketplaceInquiry}>
              <input type="hidden" name="listing_id" value={listing.id}/>
              <label className={styles.label} htmlFor="first-market-message">Message (10–4,000 characters)</label>
              <textarea className={styles.field} id="first-market-message" name="message"
                required minLength={10} maxLength={4000}
                placeholder="Hi, I'd like to know more about the delivery process and availability."/>
              <button className={styles.button} type="submit">Send inquiry</button>
            </form>
          </>}
        </section>
      </div>
    </div>

  </main>;
}
