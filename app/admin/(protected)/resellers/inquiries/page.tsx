import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import styles from "../../admin.module.css";

export const dynamic="force-dynamic";

export default async function OwnerMarketplaceInquiries(){
  await requireOwner();
  const db=createAdminClient();
  const {data,error}=await db.from("birdshop_marketplace_threads")
    .select("id,seller_id,listing_id,buyer_user_id,status,updated_at")
    .order("updated_at",{ascending:false}).limit(100);
  if(error)throw new Error("Marketplace inquiries could not be loaded.");
  const threads=data||[];
  const sellers=[...new Set(threads.map(t=>t.seller_id))];
  const {data:profiles}=sellers.length?await db.from("birdshop_seller_profiles")
    .select("id,display_name").in("id",sellers):{data:[]};

  return <div className={styles.page}>
    <AdminSidebar/>
    <main className={styles.content}>
      <header className={styles.topbar}><div>
        <span>OWNER OVERSIGHT / MARKETPLACE</span>
        <h1>Seller inquiries</h1>
        <p>Private buyer–seller messages are accessible to authorized administration for moderation and dispute support.</p>
      </div>
        <Link href="/admin/resellers">← Resellers</Link>
      </header>
      <section style={{marginTop:28}}>
        {!threads.length?<p>No marketplace conversations have been started.</p>:(
          <div style={{display:"grid",gap:15}}>
            {threads.map(t=><article key={t.id}
              style={{border:"1px solid #ffffff30",background:"#090909",color:"#f2eee8",padding:18}}>
              <p>Seller: <strong>{profiles?.find(p=>p.id===t.seller_id)?.display_name||"Unknown"}</strong></p>
              <p>Status: {t.status} · {new Date(t.updated_at).toLocaleString()}</p>
              <Link href={`/admin/resellers/inquiries/${t.id}`} style={{color:"#e59cb0"}}>
                Review conversation
              </Link>
            </article>)}
          </div>
        )}
      </section>
    </main>
  </div>;
}
