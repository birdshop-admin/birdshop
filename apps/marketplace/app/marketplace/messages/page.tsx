import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMarketplaceUser } from "@/lib/marketplace";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Your marketplace messages | BirdShop"};

export default async function MarketplaceBuyerInbox(){
  const user=await requireMarketplaceUser();
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_marketplace_threads")
    .select("id,seller_id,listing_id,status,updated_at")
    .eq("buyer_user_id",user.id).order("updated_at",{ascending:false}).limit(100);
  if(error)throw new Error("Your marketplace inbox is temporarily unavailable.");
  const threads=data||[];
  const sellerIds=[...new Set(threads.map(t=>t.seller_id))];
  const sellerResult=sellerIds.length?await db.from("birdshop_seller_profiles")
    .select("id,display_name").in("id",sellerIds):{data:[]};
  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">

    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / BUYER MESSAGES</span>
        <h1>Your inquiries.</h1>
        <p>Private conversations with approved BirdShop marketplace sellers.</p>
        <div className={styles.actions}><Link className={styles.outline} href="/marketplace">Browse marketplace</Link></div>
      </header>
      <section className={styles.card} style={{marginTop:35}}>
        <h2>Conversations</h2>
        {!threads.length?<p>No seller inquiries yet. Visit a listing and select Ask seller to start one.</p>:(
          <ul className={styles.list}>{threads.map(thread=><li key={thread.id}>
            <div>
              <p style={{margin:"0 0 5px"}}><strong>{sellerResult.data?.find(s=>s.id===thread.seller_id)?.display_name||"Marketplace seller"}</strong></p>
              <span className={styles.meta}>{thread.status} · {new Date(thread.updated_at).toLocaleString()}</span>
            </div>
            <Link className={styles.outline} href={`/marketplace/messages/${thread.id}`}>Open conversation</Link>
          </li>)}</ul>
        )}
      </section>
    </div>

  </main>;
}
