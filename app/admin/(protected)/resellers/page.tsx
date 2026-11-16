import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { marketplaceMoney } from "@/lib/marketplace";
import { moderateSellerListing, reviewSellerApplication, setSellerCommission, updateSellerStatus } from "./actions";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";
type Application={
  id:string; business_name:string; requested_handle:string;
  contact_email:string;description:string;categories:string[];
  payout_preference:string; status:string;review_note:string|null;created_at:string;
};
type Profile={id:string;handle:string;display_name:string;status:string;commission_bps:number;};
type Listing={id:string;title:string;slug:string;seller_id:string;status:string;
  listing_type:string;stock:number;price_cents:number;created_at:string;};
type Audit={id:number;entity_type:string;action:string;created_at:string};

const cardStyle:React.CSSProperties={
  border:"1px solid #ffffff38",background:"#090909",padding:22,marginTop:18,
  borderRadius:3,color:"#f3ece7",
};
const inputStyle:React.CSSProperties={
  background:"#0b0b0b",color:"#f9f5f1",border:"1px solid #ffffff60",
  borderRadius:2,padding:"9px 11px",minHeight:39,
};
const buttonStyle:React.CSSProperties={
  padding:"10px 14px",color:"#fff",background:"#94152d",
  border:"1px solid #b8223e",borderRadius:2,cursor:"pointer",
};

export default async function ResellerAdminPage(){
  await requireOwner();
  const db=createAdminClient();
  const [appResult,sellerResult,listingResult,auditResult,disputes,payouts]=await Promise.all([
    db.from("birdshop_seller_applications")
      .select("id,business_name,requested_handle,contact_email,description,categories,payout_preference,status,review_note,created_at")
      .order("created_at",{ascending:false}).limit(100),
    db.from("birdshop_seller_profiles")
      .select("id,handle,display_name,status,commission_bps")
      .order("created_at",{ascending:false}).limit(100),
    db.from("birdshop_marketplace_listings")
      .select("id,title,slug,seller_id,status,listing_type,stock,price_cents,created_at")
      .order("created_at",{ascending:false}).limit(100),
    db.from("birdshop_marketplace_audit")
      .select("id,entity_type,action,created_at").order("created_at",{ascending:false}).limit(20),
    db.from("birdshop_marketplace_disputes").select("id,status").limit(100),
    db.from("birdshop_marketplace_payouts").select("id,status").limit(100),
  ]);
  const ready= !appResult.error&&!sellerResult.error&&!listingResult.error;
  const applications=(appResult.data||[]) as Application[];
  const sellers=(sellerResult.data||[]) as Profile[];
  const listings=(listingResult.data||[]) as Listing[];
  const events=(auditResult.data||[]) as Audit[];
  const pendingApplications=applications.filter(a=>a.status==="pending");
  const pendingListings=listings.filter(a=>a.status==="pending_review");
  return <div className={styles.page}>
    <AdminSidebar/>
    <main className={styles.content}>
      <header className={styles.topbar}>
        <div><span>BIRDSHOP / MARKETPLACE OPERATIONS</span><h1>Resellers</h1>
          <p>Owner approvals, listing moderation, marketplace rules and audit history.</p>
        </div>
        <Link href="/marketplace">Public marketplace ↗</Link>
      </header>
      {!ready ? <div role="alert" style={cardStyle}>
        Seller tables are not available yet. Apply the approved Phase 1 marketplace migration in the chosen staging environment.
      </div> : <>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:15,margin:"27px 0"}}>
          {[
            ["Seller applications",pendingApplications.length],
            ["Approved profiles",sellers.filter(s=>s.status==="active").length],
            ["Listings to review",pendingListings.length],
            ["Published listings",listings.filter(s=>s.status==="published").length],
            ["Open disputes",disputes.data?.filter(d=>d.status==="open").length||0],
            ["Payout requests",payouts.data?.filter(p=>p.status==="requested").length||0]
          ].map(([label,value])=><div key={String(label)} style={cardStyle}>
            <p style={{color:"#b3aeb0",fontSize:12}}>{label}</p>
            <strong style={{font:"italic 38px Georgia,serif"}}>{value}</strong>
          </div>)}
        </div>
        <section aria-labelledby="app-head">
          <h2 id="app-head">Pending applications</h2>
          {!pendingApplications.length&&<p>No applications awaiting review.</p>}
          {pendingApplications.map(app=><article key={app.id} style={cardStyle}>
            <h3 style={{font:"italic 27px Georgia,serif"}}>{app.business_name}</h3>
            <p><strong>Requested:</strong> /shops/{app.requested_handle} · <strong>Applicant:</strong> {app.contact_email}</p>
            <p><strong>Categories:</strong> {app.categories.join(", ")} · <strong>Payout preference:</strong> {app.payout_preference}</p>
            <p style={{whiteSpace:"pre-wrap",lineHeight:1.7}}>{app.description}</p>
            <form action={reviewSellerApplication}
              style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"end"}}>
              <input type="hidden" name="id" value={app.id}/>
              <label style={{display:"grid",gap:6,fontSize:12}}>Review note
                <input style={inputStyle} name="note" maxLength={1000} placeholder="Reason or private note"/>
              </label>
              <button style={buttonStyle} type="submit" name="action" value="approved">Approve seller</button>
              <button style={{...buttonStyle,background:"#181818"}} type="submit" name="action" value="rejected">Reject</button>
            </form>
          </article>)}
        </section>
        <section aria-labelledby="sellers-head" style={{marginTop:44}}>
          <h2 id="sellers-head">Seller accounts</h2>
          {!sellers.length&&<p>No sellers approved yet.</p>}
          {sellers.map(seller=><article key={seller.id} style={cardStyle}>
            <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:16}}>
              <div>
                <h3 style={{font:"italic 25px Georgia,serif"}}>{seller.display_name}</h3>
                <p><Link href={`/shops/${seller.handle}`}>/shops/{seller.handle}</Link> · {seller.status}</p>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <form action={setSellerCommission}>
                  <input type="hidden" name="seller_id" value={seller.id}/>
                  <label style={{display:"block",fontSize:12}}>Commission (%)</label>
                  <input style={{...inputStyle,width:75}} type="number" name="commission_percentage"
                    step=".01" min="0" max="50" defaultValue={(seller.commission_bps/100).toFixed(2)}/>
                  <button style={buttonStyle} type="submit">Save rate</button>
                </form>
                <form action={updateSellerStatus}>
                  <input type="hidden" name="seller_id" value={seller.id}/>
                  <input type="hidden" name="status" value={seller.status==="active"?"suspended":"active"}/>
                  <button style={{...buttonStyle,background:seller.status==="active"?"#681023":"#243023"}} type="submit">
                    {seller.status==="active"?"Suspend":"Restore"} seller
                  </button>
                </form>
              </div>
            </div>
          </article>)}
        </section>
        <section aria-labelledby="listing-head" style={{marginTop:44}}>
          <h2 id="listing-head">Listings awaiting moderation</h2>
          {!pendingListings.length&&<p>No listings waiting for approval.</p>}
          {pendingListings.map(listing=><article key={listing.id} style={cardStyle}>
            <h3 style={{font:"italic 25px Georgia,serif"}}>{listing.title}</h3>
            <p>{listing.listing_type.replace("_"," ")} · {marketplaceMoney(listing.price_cents)} · Stock {listing.stock}</p>
            <p>Seller: {sellers.find(s=>s.id===listing.seller_id)?.display_name||"Unknown"}</p>
            <form action={moderateSellerListing}
              style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"end"}}>
              <input type="hidden" name="listing_id" value={listing.id}/>
              <label style={{display:"grid",gap:5,fontSize:12}}>Reason (if rejecting)
                <input name="reason" style={inputStyle} maxLength={1000}/>
              </label>
              <button style={buttonStyle} type="submit" name="status" value="published">Publish</button>
              <button style={{...buttonStyle,background:"#181818"}} type="submit" name="status" value="rejected">Reject</button>
            </form>
          </article>)}
        </section>
        <section aria-labelledby="financial-head" style={{marginTop:44}}>
          <h2 id="financial-head">Disputes and payouts</h2>
          <div style={cardStyle}>
            <p>Order settlement and seller withdrawals are not enabled. Pending financial records and disputes will appear here after verified marketplace checkout is integrated.</p>
            <p>Existing BirdShop Stripe orders and refunds remain in the original admin sections.</p>
          </div>
        </section>
        <section aria-labelledby="audit-head" style={{marginTop:44}}>
          <h2 id="audit-head">Recent marketplace audit</h2>
          <div style={cardStyle}>
            {!events.length&&<p>No marketplace events recorded yet.</p>}
            {events.map(event=><p key={event.id} style={{fontSize:12}}>
              {new Date(event.created_at).toLocaleString()} · {event.entity_type} · {event.action}
            </p>)}
          </div>
        </section>
      </>}
    </main>
  </div>;
}
