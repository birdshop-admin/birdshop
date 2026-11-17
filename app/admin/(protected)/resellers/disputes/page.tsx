import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerReviewMarketplaceDispute } from "@/app/marketplace/orders/actions";
import styles from "../../admin.module.css";

export const dynamic="force-dynamic";

type Dispute={
  id:string; order_id:string; buyer_user_id:string;seller_id:string;
  reason:string;status:string;created_at:string;resolution_note:string|null;
};

export default async function OwnerSellerDisputes(){
  await requireOwner();
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_marketplace_disputes")
    .select("id,order_id,buyer_user_id,seller_id,reason,status,created_at,resolution_note")
    .order("created_at",{ascending:false}).limit(100);
  const disputes=(data||[]) as Dispute[];
  const sellerIds=[...new Set(disputes.map(d=>d.seller_id))];
  const sellers=sellerIds.length?await db.from("birdshop_seller_profiles")
    .select("id,display_name").in("id",sellerIds):{data:[] as {id:string;display_name:string}[]};

  return <div className={styles.page}><AdminSidebar/><main className={styles.content}>
    <header className={styles.topbar}><div>
      <span>OWNER ONLY / BUYER PROTECTION</span>
      <h1>Seller disputes</h1>
      <p>Investigate reported non-delivery and other fulfillment concerns. Payouts remain held while disputes are open.</p>
    </div><Link href="/admin/resellers">← Resellers</Link></header>
    <section style={{marginTop:26}}>
      {error?<p role="alert">Marketplace dispute tables are unavailable. Apply the approved migration in a review environment.</p>:<>
        <p><strong>Refunds are not enabled in this marketplace.</strong> A refund must be confirmed by its payment provider and reconciled before the corresponding order can be marked refunded. Do not resolve a dispute by changing the order state manually.</p>
        {!disputes.length&&<div style={{padding:24,border:"1px solid #ffffff36"}}>
          There are no marketplace disputes.
        </div>}
        {disputes.map(d=><article key={d.id} style={{
          background:"#090909",border:"1px solid #ffffff39",padding:24,marginTop:18,
          color:"#eee",overflowWrap:"anywhere"}}>
          <h2 style={{font:"italic 28px Georgia,serif",marginTop:0}}>
            Dispute {d.id.slice(0,8)}
          </h2>
          <p>Status: <strong>{d.status.replaceAll("_"," ")}</strong> ·
            Seller: {sellers.data?.find(s=>s.id===d.seller_id)?.display_name||"Unknown"}</p>
          <p>Opened: {new Date(d.created_at).toLocaleString()} · Order: {d.order_id}</p>
          <p style={{whiteSpace:"pre-wrap"}}><strong>Buyer statement:</strong> {d.reason}</p>
          {d.resolution_note&&<p>Resolution note: {d.resolution_note}</p>}
          {d.status==="open"&&<form action={ownerReviewMarketplaceDispute}>
            <input type="hidden" name="dispute_id" value={d.id}/>
            <button type="submit" style={{
              background:"#96152c",color:"#fff",padding:"12px 18px",
              border:"1px solid #c0354b",cursor:"pointer",
            }}>Begin investigation</button>
          </form>}
          {d.status==="under_review"&&<p>
            Investigation active. Manual refund or seller-release resolution is disabled
            until an approved payment provider and dispute evidence workflow are configured.
          </p>}
          <p><Link href="/admin/resellers/inquiries">Inspect buyer–seller conversations</Link></p>
        </article>)}
      </>}
    </section>
  </main></div>;
}
