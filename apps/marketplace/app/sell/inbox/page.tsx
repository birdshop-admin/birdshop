import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedSeller } from "@/lib/marketplace";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Seller inbox | BirdShop"};

export default async function SellerInbox(){
  const {profile}=await requireApprovedSeller();
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_marketplace_threads")
    .select("id,buyer_user_id,listing_id,status,updated_at")
    .eq("seller_id",profile.id).order("updated_at",{ascending:false}).limit(100);
  if(error)throw new Error("Seller inbox is temporarily unavailable.");
  const threads=data||[];
  const listingIds=[...new Set(threads.map(t=>t.listing_id).filter((v):v is string=>Boolean(v)))];
  const listingResult=listingIds.length?await db.from("birdshop_marketplace_listings")
    .select("id,title").in("id",listingIds):{data:[]};
  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">

    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / SELLER COMMUNICATIONS</span>
        <h1>Your inbox.</h1>
        <p>Respond to buyer questions. Keep all communication inside BirdShop and do not request off-platform payments or passwords.</p>
        <div className={styles.actions}>
          <Link className={styles.outline} href="/sell/dashboard">Seller dashboard</Link>
        </div>
      </header>
      <section className={styles.card} style={{marginTop:35}}>
        <h2>Buyer inquiries</h2>
        {!threads.length?<p>No buyer messages yet. Inquiries will appear after a customer opens a conversation on a published listing.</p>:(
          <ul className={styles.list}>{threads.map(thread=><li key={thread.id}>
            <div>
              <p style={{margin:"0 0 6px"}}><strong>{listingResult.data?.find(l=>l.id===thread.listing_id)?.title||"General marketplace inquiry"}</strong></p>
              <span className={styles.meta}>{thread.status} · {new Date(thread.updated_at).toLocaleString()}</span>
            </div>
            <Link className={styles.outline} href={`/marketplace/messages/${thread.id}`}>Reply</Link>
          </li>)}</ul>
        )}
      </section>
    </div>

  </main>;
}
