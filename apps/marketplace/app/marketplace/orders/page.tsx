import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMarketplaceUser, marketplaceMoney } from "@/lib/marketplace";
import {
  buyerCancelUnpaidMarketplaceOrder,
  buyerConfirmMarketplaceDelivery,
  buyerOpenMarketplaceDispute,
} from "./actions";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Marketplace orders | BirdShop"};

type Order = {
  id:string; state:string;quantity:number;subtotal_cents:number;currency:string;
  listing_id:string;seller_id:string;created_at:string;
  delivered_at:string|null;delivery_note:string|null;
  buyer_confirmed_at:string|null;
};

export default async function BuyerMarketplaceOrders(){
  const user=await requireMarketplaceUser();
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_marketplace_orders")
    .select("id,state,quantity,subtotal_cents,currency,listing_id,seller_id,created_at,delivered_at,delivery_note,buyer_confirmed_at")
    .eq("buyer_user_id",user.id).order("created_at",{ascending:false}).limit(100);
  if(error)throw new Error("Marketplace order history is unavailable until the order database is set up.");
  const orders=(data||[]) as Order[];
  const listingIds=[...new Set(orders.map(o=>o.listing_id))];
  const sellerIds=[...new Set(orders.map(o=>o.seller_id))];
  const [listed,sellers]=await Promise.all([
    listingIds.length?db.from("birdshop_marketplace_listings").select("id,title").in("id",listingIds)
      :Promise.resolve({data:[] as {id:string;title:string}[]}),
    sellerIds.length?db.from("birdshop_seller_profiles").select("id,display_name,handle").in("id",sellerIds)
      :Promise.resolve({data:[] as {id:string;display_name:string;handle:string}[]}),
  ]);
  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">

    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / BUYER ORDERS</span>
        <h1>Your orders.</h1>
        <p>Track seller purchases, confirm verified delivery and report issues. Marketplace purchases are currently in sandbox mode.</p>
        <div className={styles.actions}><Link className={styles.outline} href="/marketplace">Browse marketplace</Link>
          <Link className={styles.outline} href="/marketplace/messages">Buyer messages</Link></div>
      </header>
      <div className={styles.stack}>
        {!orders.length&&<section className={styles.card}>
          <h2>No marketplace orders yet.</h2>
          <p>Test purchases appear here when marketplace sandbox checkout is enabled. Existing BirdShop product purchases remain under the original order tracker.</p>
          <Link href="https://birdshop.store/orders/access" className={styles.outline}>First-party order tracker</Link>
        </section>}
        {orders.map(o=>{
          const listing=listed.data?.find(l=>l.id===o.listing_id);
          const seller=sellers.data?.find(s=>s.id===o.seller_id);
          return <section className={styles.card} key={o.id}>
            <span className={styles.status}>{o.state.replaceAll("_"," ")}</span>
            <h2 style={{marginTop:16}}>{listing?.title||"Marketplace listing"}</h2>
            <p>Sold by {seller? <Link href={`/shops/${seller.handle}`}>{seller.display_name}</Link>:"Marketplace seller"}</p>
            <p>Quantity {o.quantity} · {marketplaceMoney(o.subtotal_cents)} · Ordered {new Date(o.created_at).toLocaleDateString()}</p>
            {o.delivery_note&&<p><strong>Seller delivery note:</strong> {o.delivery_note}</p>}
            <div className={styles.actions}>
              {o.state==="payment_pending"&&<form action={buyerCancelUnpaidMarketplaceOrder}>
                <input type="hidden" name="order_id" value={o.id}/>
                <button className={styles.outline} type="submit">Cancel unpaid order</button>
              </form>}
              {o.state==="delivered"&&<form action={buyerConfirmMarketplaceDelivery}>
                <input type="hidden" name="order_id" value={o.id}/>
                <button className={styles.button} type="submit">I received this order</button>
              </form>}
            </div>
            {["paid","fulfillment_pending","delivered","buyer_confirmed","completed"].includes(o.state)&&
              <details style={{marginTop:22}}>
                <summary style={{cursor:"pointer",color:"#e9a5b3"}}>Report a delivery problem</summary>
                <form action={buyerOpenMarketplaceDispute}>
                  <input type="hidden" name="order_id" value={o.id}/>
                  <label className={styles.label} htmlFor={`reason-${o.id}`}>Explain the issue (10–3,000 characters)</label>
                  <textarea className={styles.field} name="reason" id={`reason-${o.id}`} minLength={10} maxLength={3000} required/>
                  <p className={styles.small}>Filing a dispute pauses earnings release while the owner investigates. Do not include passwords or private redemption codes.</p>
                  <button type="submit" className={styles.button}>Open dispute</button>
                </form>
              </details>}
          </section>;
        })}
      </div>
    </div>

  </main>;
}
