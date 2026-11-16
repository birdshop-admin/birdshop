import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewRewarbleRequest } from "./actions";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

function dollars(value: number | string) {
  return new Intl.NumberFormat("en-US", { style:"currency",currency:"USD" })
    .format(Number(value) / 100);
}

type Entry = {
  id:string; customer_name:string; customer_email:string;
  cart: {name:string;quantity:number}[]; claimed_cents:number;
  expected_cents:number; code_hint:string; status:string;
  created_at:string; review_note:string|null;
};

export default async function RewarbleAdminPage() {
  await requireOwner();
  const { data, error } = await createAdminClient()
    .from("birdshop_rewarble_requests")
    .select("id,customer_name,customer_email,cart,claimed_cents,expected_cents,code_hint,status,created_at,review_note")
    .order("created_at",{ascending:false}).limit(100);

  return (
    <main className={styles.page}>
      <AdminSidebar />
      <section className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <span>ADMINISTRATION / PAYMENT REQUESTS</span>
            <h1>Rewarble review queue</h1>
            <p>Manual voucher transfer requests only. No automatic fulfillment or payment confirmation.</p>
          </div>
        </header>
        {error ? (
          <p role="alert">Rewarble review tables are unavailable. Apply the staging migration before enabling intake.</p>
        ) : (
          <div style={{display:"grid",gap:16,marginTop:25}}>
            {(data as Entry[] ?? []).length === 0 && <p>No voucher requests yet.</p>}
            {(data as Entry[] ?? []).map(request => (
              <article key={request.id} style={{
                border:"1px solid #ffffff45",padding:19,
                background:"#080808",color:"#eee",borderRadius:3
              }}>
                <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <strong style={{fontSize:17}}>{request.customer_name}</strong>
                    <div>{request.customer_email}</div>
                    <small>{new Date(request.created_at).toLocaleString()}</small>
                  </div>
                  <div>
                    <div><strong>Status:</strong> {request.status.replaceAll("_"," ")}</div>
                    <div>Claimed value: {dollars(request.claimed_cents)}</div>
                    <div>Current cart at submission: {dollars(request.expected_cents)}</div>
                    <small>Code ending: ••••{request.code_hint}</small>
                  </div>
                </div>
                <p>{(request.cart ?? []).map(item=>item.name+" ×"+item.quantity).join("; ")}</p>
                {request.review_note && <p>Review note: {request.review_note}</p>}
                {request.status === "pending_review" && (
                  <>
                    <Link href={`/admin/rewarble/${request.id}`}
                      style={{color:"#f4a8b4",textDecoration:"underline"}}>
                      Reveal code (owner only, audited)
                    </Link>
                    <form action={reviewRewarbleRequest}
                      style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:15}}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="from" value={request.status} />
                      <label style={{display:"grid",gap:5}}>
                        Private review note
                        <input name="note" maxLength={500} placeholder="Optional note" />
                      </label>
                      <button type="submit" name="status" value="redeemed">
                        Mark redeemed after verification
                      </button>
                      <button type="submit" name="status" value="rejected">
                        Reject request
                      </button>
                    </form>
                  </>
                )}
                {request.status === "redeemed" && (
                  <form action={reviewRewarbleRequest}>
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="from" value={request.status} />
                    <input type="hidden" name="note" value="" />
                    <p>Voucher redemption was recorded manually. Product delivery is a separate manual action.</p>
                    <button type="submit" name="status" value="fulfilled">
                      Mark manually fulfilled
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
