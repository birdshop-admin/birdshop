import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptInventoryCode } from "@/lib/inventory-crypto";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function RewarbleCodeReview({
  params,
}: { params: Promise<{id:string}> }) {
  const { user } = await requireOwner();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();

  const db = createAdminClient();
  const { data, error } = await db.from("birdshop_rewarble_requests")
    .select("id,customer_name,customer_email,encrypted_code,code_hint,status")
    .eq("id",id).single();
  if (error || !data || data.status !== "pending_review" || !data.encrypted_code)
    notFound();

  const { error: auditError } = await db.from("birdshop_rewarble_audit")
    .insert({request_id:id,actor_id:user.id,event:"code_viewed"});
  if (auditError) throw new Error("Voucher code access could not be recorded.");

  // Only owner's authenticated admin page renders the decrypted voucher.
  // Never put the code into logs, emails, URLs or browser localStorage.
  const code = decryptInventoryCode(data.encrypted_code);

  return (
    <main className={styles.page}>
      <AdminSidebar />
      <section className={styles.content}>
        <header className={styles.topbar}><div>
          <span>OWNER ONLY / AUDITED REVEAL</span>
          <h1>Verify Rewarble voucher</h1>
          <p>Do not mark redeemed until the funds have actually credited to your verified Rewarble account.</p>
        </div></header>
        <section style={{marginTop:35,maxWidth:660,padding:25,background:"#080808",
          border:"1px solid #ffffff45",color:"#eee"}}>
          <p>Customer: {data.customer_name} — {data.customer_email}</p>
          <p>Voucher ending: ••••{data.code_hint}</p>
          <code style={{display:"block",padding:"20px 12px",background:"#000",
            border:"1px solid #ffffff38",fontSize:"clamp(20px,3vw,32px)",
            letterSpacing:".12em",userSelect:"all",wordBreak:"break-all"}}>
            {code.replace(/(\d{4})(?=\d)/g,"$1 ")}
          </code>
          <p style={{fontSize:13}}>This one-time code is visible only in this owner-authenticated review page. Access is audited. Rewarble may require account verification and fees.</p>
          <p>
            <a href="https://rewarble.com/redeem" target="_blank" rel="noopener noreferrer">
              Open official Rewarble redemption page ↗
            </a>
          </p>
          <Link href="/admin/rewarble">← Back to review queue</Link>
        </section>
      </section>
    </main>
  );
}
