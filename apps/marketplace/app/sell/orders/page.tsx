import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedSeller,marketplaceMoney } from "@/lib/marketplace";
import { sellerBeginMarketplaceFulfillment, sellerMarkMarketplaceDelivered } from "@/app/marketplace/orders/actions";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Seller orders | BirdShop"};

type Order={
  id:string;listing_id:string;state:string;quantity:number;subtotal_cents:number;
  commission_cents:number;created_at:string;delivery_note:string|null;paid_at:string|null;
};

export default async function SellerMarketplaceOrders(){
  const {profile}=await requireApprovedSeller();
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_marketplace_orders")
    .select("id,listing_id,state,quantity,subtotal_cents,commission_cents,created_at,delivery_note,paid_at")
    .eq("seller_id",profile.id).order("created_at",{ascending:false}).limit(100);
  if(error)throw new Error("Seller order tracking is not ready in this database.");
  const orders=(data||[]) as Order[];
  const ids=[...new Set(orders.map(o=>o.listing_id))];
  const {data:listings}=ids.length?await db.from("birdshop_marketplace_listings")
    .select("id,title").in("id",ids):{data:[] as {id:string;title:string}[]};
  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">

    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / SELLER FULFILLMENT</span>
        <h1>Your orders.</h1>
        <p>Seller fulfillment begins only after BirdShop verifies payment with the payment provider. Marketplace payments are sandbox-only until launch approval.</p>
        <div className={styles.actions}><Link className={styles.outline} href="/sell/dashboard">Seller dashboard</Link>
          <Link className={styles.outline} href="/sell/inbox">Seller inbox</Link></div>
      </header>
      <div className={styles.stack}>
        {!orders.length&&<section className={styles.card}>
          <h2>No marketplace orders yet.</h2>
          <p>Your approved listings can receive buyer inquiries. Verified sandbox purchases appear here when test checkout is enabled.</p>
        </section>}
        {orders.map(o=><section className={styles.card} key={o.id}>
          <span className={styles.status}>{o.state.replaceAll("_"," ")}</span>
          <h2 style={{marginTop:18}}>{listings?.find(l=>l.id===o.listing_id)?.title||"Marketplace item"}</h2>
          <p>Quantity {o.quantity} · Sale {marketplaceMoney(o.subtotal_cents)} · Fee {marketplaceMoney(o.commission_cents)}</p>
          <p>Seller proceeds before refunds or chargebacks: {marketplaceMoney(o.subtotal_cents-o.commission_cents)}</p>
          <p>{o.paid_at?"Provider-verified payment recorded.":"Payment not verified — do not deliver."}</p>
          {o.state==="paid"&&<form action={sellerBeginMarketplaceFulfillment}>
            <input type="hidden" name="order_id" value={o.id}/>
            <button className={styles.button} type="submit">Begin fulfillment</button>
          </form>}
          {o.state==="fulfillment_pending"&&<form action={sellerMarkMarketplaceDelivered}>
            <input type="hidden" name="order_id" value={o.id}/>
            <label className={styles.label} htmlFor={`seller-note-${o.id}`}>What was delivered?</label>
            <textarea className={styles.field} id={`seller-note-${o.id}`} name="delivery_note"
              minLength={5} maxLength={3000} required
              placeholder="Describe delivery without sharing customer credentials."/>
            <button className={styles.button} type="submit">Mark delivered</button>
          </form>}
          {o.state==="disputed"&&<p className={styles.notice}>
            This order is disputed. Buyer funds and seller earnings require owner review. Contact support through the private order conversation.
          </p>}
          {o.delivery_note&&<p><strong>Delivery summary:</strong> {o.delivery_note}</p>}
        </section>)}
      </div>
    </div>

  </main>;
}
