import { revalidatePath } from "next/cache";
import AdminSidebar from "@/components/AdminSidebar";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

async function registerReferrer(formData: FormData) {
  "use server";
  await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const kind = String(formData.get("kind") ?? "customer");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 ||
      displayName.length < 1 || displayName.length > 80 ||
      !/^[A-Z0-9]{6,20}$/.test(code) || !["customer","affiliate"].includes(kind)) {
    throw new Error("Enter a valid email, name, and 6–20 character alphanumeric code.");
  }
  const { error } = await createAdminClient().from("birdshop_referrers").insert({
    contact_email: email, display_name: displayName, code, kind, status: "pending"
  });
  if (error) throw new Error("Could not register referrer. Check for a duplicate email or code.");
  revalidatePath("/admin/referrals");
}

async function changeStatus(formData: FormData) {
  "use server";
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approved","rejected","suspended","pending"].includes(status)) {
    throw new Error("Invalid referrer or status.");
  }
  const { error } = await createAdminClient().from("birdshop_referrers").update({
    status, approved_at: status === "approved" ? new Date().toISOString() : null
  }).eq("id", id);
  if (error) throw new Error("Unable to update referrer.");
  revalidatePath("/admin/referrals");
}

async function reviewReward(formData: FormData) {
  "use server";
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approved","rejected","paid"].includes(status)) {
    throw new Error("Invalid reward review.");
  }
  const db = createAdminClient();
  const { data: reward, error: lookupError } = await db.from("birdshop_referral_rewards")
    .select("id,status,order_id").eq("id",id).single();
  if (lookupError || !reward) throw new Error("Reward unavailable.");
  if (status === "paid" && reward.status !== "approved") throw new Error("Approve before marking paid.");
  if (status !== "paid" && reward.status !== "pending_review") throw new Error("Only pending rewards can be reviewed.");
  const { data: order, error: orderError } = await db.from("orders")
    .select("payment_status,refunded_amount").eq("id",reward.order_id).single();
  if (orderError || !order || order.payment_status !== "paid" || Number(order.refunded_amount ?? 0) > 0) {
    throw new Error("Reward order is not eligible. Investigate payment/refund state.");
  }
  const { error } = await db.from("birdshop_referral_rewards").update({
    status, reviewed_at: new Date().toISOString(),
    ...(status === "paid" ? { paid_at: new Date().toISOString() } : {})
  }).eq("id",id).eq("status",reward.status);
  if (error) throw new Error("Could not review reward.");
  revalidatePath("/admin/referrals");
}

export default async function ReferralAdmin() {
  await requireOwner();
  const db = createAdminClient();
  const [referrersResult, rewardsResult] = await Promise.all([
    db.from("birdshop_referrers").select("id,display_name,contact_email,code,kind,status,created_at")
      .order("created_at",{ascending:false}).limit(100),
    db.from("birdshop_referral_rewards").select("id,referrer_id,referred_email,amount_cents,status,created_at,order_id")
      .order("created_at",{ascending:false}).limit(100)
  ]);
  if (referrersResult.error || rewardsResult.error) {
    throw new Error("Referral tables unavailable. Apply the staged migration before using this page.");
  }
  const referrers = referrersResult.data ?? [];
  const rewards = rewardsResult.data ?? [];
  const names = new Map(referrers.map(r => [r.id,r.display_name]));
  return <main className={styles.page}>
    <AdminSidebar />
    <section className={styles.content}>
      <header className={styles.topbar}><div><span>BIRDSHOP / REFERRALS</span>
        <h1>Referrals & affiliates</h1>
        <p>Owner-reviewed $0.50 rewards. No automatic payments.</p></div></header>
      <div style={{display:"grid",gap:24}}>
        <section><h2>Register a referrer</h2>
          <form action={registerReferrer} style={{display:"flex",flexWrap:"wrap",gap:10}}>
            <input name="name" aria-label="Display name" placeholder="Display name" required maxLength={80}/>
            <input name="email" aria-label="Contact email" type="email" placeholder="Email" required/>
            <input name="code" aria-label="Referral code" placeholder="Code (6–20 letters/numbers)" required minLength={6} maxLength={20} pattern="[A-Za-z0-9]{6,20}"/>
            <select name="kind" aria-label="Referral type"><option value="customer">Customer</option><option value="affiliate">Affiliate applicant</option></select>
            <button type="submit">Register (pending)</button>
          </form>
        </section>
        <section><h2>Referrers ({referrers.length} shown)</h2>
          <div style={{overflowX:"auto"}}><table><thead><tr><th>Name</th><th>Type</th><th>Code / link</th><th>Status</th><th>Review</th></tr></thead><tbody>
            {referrers.map(r=><tr key={r.id}>
              <td>{r.display_name}<small style={{display:"block"}}>{r.contact_email}</small></td>
              <td>{r.kind}</td><td><code>{r.code}</code><small style={{display:"block"}}>https://birdshop.store/ref/{r.code}</small></td>
              <td>{r.status}</td><td><form action={changeStatus}>
                <input type="hidden" name="id" value={r.id}/>
                <select name="status" defaultValue={r.status}>
                  <option value="pending">Pending</option><option value="approved">Approve</option>
                  <option value="rejected">Reject</option><option value="suspended">Suspend</option>
                </select><button type="submit">Save</button>
              </form></td>
            </tr>)}</tbody></table></div>
        </section>
        <section><h2>Reward ledger ({rewards.length} shown)</h2>
          <p>Approve eligible rewards after manual fraud checks. Mark paid only after making an actual payout outside BirdShop.</p>
          <div style={{overflowX:"auto"}}><table><thead><tr><th>Referrer</th><th>Customer</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {rewards.map(r=><tr key={r.id}>
              <td>{names.get(r.referrer_id) ?? r.referrer_id}</td><td>{r.referred_email}</td>
              <td>${(r.amount_cents/100).toFixed(2)}</td><td>{r.status}</td>
              <td>{["pending_review","approved"].includes(r.status) ?
                <form action={reviewReward}><input type="hidden" name="id" value={r.id}/>
                  <select name="status">
                    {r.status === "pending_review" ? <><option value="approved">Approve</option><option value="rejected">Reject</option></> :
                      <option value="paid">Mark paid</option>}
                  </select><button type="submit">Apply</button></form> : "—"}</td>
            </tr>)}</tbody></table></div>
        </section>
      </div>
    </section>
  </main>;
}
