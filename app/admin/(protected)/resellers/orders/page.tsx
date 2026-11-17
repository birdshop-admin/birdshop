import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { marketplaceMoney } from "@/lib/marketplace";
import { ownerCompleteMarketplaceOrder, ownerReleaseMarketplaceEarnings } from "@/app/marketplace/orders/actions";
import styles from "../../admin.module.css";

export const dynamic="force-dynamic";
type Order={
  id:string; listing_id:string;seller_id:string;state:string;quantity:number;
  subtotal_cents:number; commission_cents:number;commission_bps:number;
  payment_provider:string|null;payment_reference:string|null;
  payment_verified_at:string|null;created_at:string;completed_at:string|null;
  payout_eligible_after:string|null;
};
type Ledger={order_id:string;amount_cents:number;status:string;entry_type:string};

export default async function OwnerMarketplaceOrders(){
  await requireOwner();
  const db=createAdminClient();
  const [ordersResult,ledgerResult]=await Promise.all([
    db.from("birdshop_marketplace_orders")
      .select("id,listing_id,seller_id,state,quantity,subtotal_cents,commission_cents,commission_bps,payment_provider,payment_reference,payment_verified_at,created_at,completed_at,payout_eligible_after")
      .order("created_at",{ascending:false}).limit(100),
    db.from("birdshop_marketplace_ledger")
      .select("order_id,amount_cents,status,entry_type").limit(300),
  ]);
  const ready=!ordersResult.error&&!ledgerResult.error;
  const orders=(ordersResult.data||[]) as Order[];
  const ledger=(ledgerResult.data||[]) as Ledger[];
  const sellerIds=[...new Set(orders.map(o=>o.seller_id))];
  const listingIds=[...new Set(orders.map(o=>o.listing_id))];
  const [sellers,items]=await Promise.all([
    sellerIds.length?db.from("birdshop_seller_profiles").select("id,display_name").in("id",sellerIds)
      :Promise.resolve({data:[] as {id:string;display_name:string}[]}),
    listingIds.length?db.from("birdshop_marketplace_listings").select("id,title").in("id",listingIds)
      :Promise.resolve({data:[] as {id:string;title:string}[]}),
  ]);
  return <div className={styles.page}><AdminSidebar/><main className={styles.content}>
    <header className={styles.topbar}><div>
      <span>OWNER ONLY / MARKETPLACE RECONCILIATION</span>
      <h1>Seller orders</h1>
      <p>Order snapshots, payment verification and settlement holds.</p>
    </div><Link href="/admin/resellers">← Resellers</Link></header>
    <section style={{marginTop:25}}>
      {!ready?<p role="alert">Marketplace order tables are not installed in this database. Migration review is still required.</p>:<>
        <p>Stripe sandbox webhooks reconcile marketplace payments. Existing BirdShop Stripe orders are not displayed in this table.</p>
        {!orders.length&&<div style={{padding:20,border:"1px solid #ffffff40"}}>
          No marketplace orders yet. Enable sandbox checkout only after configuring the test environment.
        </div>}
        {orders.map(o=>{
          const earning=ledger.find(l=>l.order_id===o.id&&l.entry_type==="earned");
          const canRelease=o.state==="completed"&&o.payout_eligible_after&&earning?.status==="pending";
          return <article key={o.id} style={{border:"1px solid #ffffff3a",background:"#090909",
            color:"#eee",padding:22,marginTop:15}}>
            <h2 style={{font:"italic 28px Georgia,serif",margin:"0 0 12px"}}>
              {items.data?.find(i=>i.id===o.listing_id)?.title||"Marketplace item"}
            </h2>
            <p>Seller: {sellers.data?.find(s=>s.id===o.seller_id)?.display_name||"Unknown"} ·
              Order state: <strong>{o.state.replaceAll("_"," ")}</strong></p>
            <p>Gross: {marketplaceMoney(o.subtotal_cents)} · Fee snapshot: {marketplaceMoney(o.commission_cents)}
              {" "}({(o.commission_bps/100).toFixed(2)}%) · Seller net: {marketplaceMoney(o.subtotal_cents-o.commission_cents)}</p>
            <p>Payment: {o.payment_verified_at? `Provider verified ${o.payment_provider||""}`:
              "Not provider-verified"} · Ledger: {earning?.status||"not posted"}</p>
            {o.payout_eligible_after&&<p>Internal journal hold expires (does not delay Stripe payouts): {new Date(o.payout_eligible_after).toLocaleString()}</p>}
            {o.state==="buyer_confirmed"&&<form action={ownerCompleteMarketplaceOrder}>
              <input type="hidden" name="order_id" value={o.id}/>
              <button type="submit" style={{padding:12,background:"#96152c",color:"#fff",
                border:"1px solid #c0354b",cursor:"pointer"}}>Complete after buyer confirmation</button>
            </form>}
            {canRelease&&<form action={ownerReleaseMarketplaceEarnings}>
              <input type="hidden" name="order_id" value={o.id}/>
              <button type="submit" style={{padding:12,background:"#96152c",color:"#fff",
                border:"1px solid #c0354b",cursor:"pointer"}}>
                Release settled earnings into available ledger
              </button>
            </form>}
            {o.state==="disputed"&&<Link href="/admin/resellers/disputes">Review associated dispute</Link>}
          </article>;
        })}
      </>}
    </section>
  </main></div>;
}
