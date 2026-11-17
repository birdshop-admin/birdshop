import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import EditorialPageHero from "@/components/EditorialPageHero";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerMyReferral, sendReferralLogin, verifyReferralCode, signOutReferral } from "./actions";
import styles from "./referrals.module.css";

export const dynamic = "force-dynamic";

const messages: Record<string,string> = {
  "check-email": "Check your email for a sign-in link or code.",
  "invalid-code": "That code or sign-in link is invalid or expired. Request another email.",
  "invalid-email": "Please enter a valid email address.",
  "email-unavailable": "Sign-in email could not be sent. Please try again later.",
  "sign-in-required": "Verify your email before joining.",
  "invalid-registration": "Please enter a display name with 2–80 characters.",
  "already-registered": "This email already has a referral account.",
  "registered": "Registration complete. Your referral details appear below.",
};

export default async function ReferralDashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const verified = Boolean(user?.email && user.email_confirmed_at);
  const email = verified ? user!.email!.toLowerCase() : null;

  let referrer: { id: string; code: string; kind: string; status: string; display_name: string } | null = null;
  let rewards: { amount_cents: number; status: string; created_at: string; referred_email: string }[] = [];
  const claimsEnabled = process.env.BIRDSHOP_POSTPURCHASE_REFERRALS_ENABLED === "true";
  let creditedBuyers = new Set<string>();
  if (email) {
    const admin = createAdminClient();
    const result = await admin.from("birdshop_referrers")
      .select("id,code,kind,status,display_name").eq("contact_email",email).maybeSingle();
    if (result.error) throw new Error("Referral dashboard is not available yet.");
    referrer = result.data;
    if (referrer) {
      const ledger = await admin.from("birdshop_referral_rewards")
        .select("amount_cents,status,created_at,referred_email").eq("referrer_id",referrer.id)
        .order("created_at",{ascending:false}).limit(100);
      if (ledger.error) throw new Error("Referral ledger is unavailable.");
      rewards = ledger.data ?? [];
      creditedBuyers = new Set(rewards.filter(r => !["rejected","reversed"].includes(r.status) && typeof r.referred_email === "string").map(r => r.referred_email.toLowerCase()));
      if (claimsEnabled) {
        const claims = await admin.from("birdshop_referral_attributions")
          .select("referred_email")
          .eq("referrer_id", referrer.id)
          .not("verified_at", "is", null)
          .limit(1000);
        if (claims.error) throw new Error("Verified referrals are unavailable.");
        for (const claim of claims.data ?? []) creditedBuyers.add(claim.referred_email.toLowerCase());
      }
    }
  }

  const approved = rewards.filter(r=>r.status==="approved");
  const paid = rewards.filter(r=>r.status==="paid");
  const pending = rewards.filter(r=>r.status==="pending_review");
  const currency = (cents:number) => `$${(cents/100).toFixed(2)}`;
  const sum = (rows:typeof rewards) => rows.reduce((n,r)=>n+r.amount_cents,0);
  const origin = (process.env.BIRDSHOP_SITE_URL ?? "https://birdshop.store").replace(/\/$/,"");

  return <main className="page-shell bs-editorial-page referrals-page">
    <SiteHeader />
    <EditorialPageHero
      section="referrals"
      eyebrow="BIRDSHOP / REWARDS"
      title="Refer friends."
      subtitle="SHARE A LINK / EARN APPROVED REWARDS"
      description="Earn $0.50 USD for each qualifying new customer's first eligible paid and fulfilled product purchase, subject to review."
    />
    <div className={`bs-referral-content ${styles.content}`}>
      <header className="bs-referral-intro">
        <span>REFERRAL PROGRAM</span>
        <h2>Share BirdShop.</h2>
        <p>Sign in with a verified email to request your referral link. Affiliate applications require approval. Every reward is reviewed before payment.</p>
      </header>
      <div className="bs-referral-steps" aria-label="How referral rewards work">
        <span><strong>01</strong> Verify your email</span>
        <span><strong>02</strong> Register or apply</span>
        <span><strong>03</strong> Share your unique link</span>
        <span><strong>04</strong> Track approved rewards</span>
      </div>
      {notice && messages[notice] && <p role="status" className={styles.notice}>{messages[notice]}</p>}

      {!verified ? <section className={styles.panel}>
        <h2>Verify your email</h2>
        <p>We use a secure email sign-in. You do not need a password.</p>
        <form action={sendReferralLogin}>
          <label htmlFor="ref-email">Your email</label>
          <input id="ref-email" className={styles.input} type="email" name="email" autoComplete="email" required maxLength={320} />
          <button type="submit" className={styles.button}>Send sign-in email</button>
        </form>
        <details className={styles.verification}><summary>Have a verification code?</summary>
          <form action={verifyReferralCode}>
            <label htmlFor="ref-code-email">Email</label>
            <input id="ref-code-email" name="email" className={styles.input} type="email" required autoComplete="email"/>
            <label htmlFor="ref-code">Email code</label>
            <input id="ref-code" name="token" className={styles.input} inputMode="numeric" pattern="[0-9]{6,8}" required />
            <button type="submit" className={styles.button}>Verify code</button>
          </form>
        </details>
      </section> : <>
        <section className={styles.panel}>
          <div className={styles.identity}>
            <p>Verified as <strong>{email}</strong></p>
            <form action={signOutReferral}><button type="submit" className={styles.button}>Sign out</button></form>
          </div>
        </section>
        {!referrer ? <section className={styles.panel}>
          <h2>Join BirdShop referrals</h2>
          <p>Customer links activate immediately after verified registration. Affiliate applications require owner approval.</p>
          <form action={registerMyReferral}>
            <label htmlFor="ref-name">Display name</label>
            <input id="ref-name" name="name" className={styles.input} required minLength={2} maxLength={80}/>
            <label htmlFor="ref-kind">Account type</label>
            <select id="ref-kind" name="kind" className={styles.input}>
              <option value="customer">Customer referral</option>
              <option value="affiliate">Apply as an affiliate</option>
            </select>
            <button type="submit" className={styles.button}>Create referral account</button>
          </form>
        </section> : <>
          <section className={styles.panel}>
            <h2>{referrer.display_name}&apos;s referral profile</h2>
            <p>Type: <strong>{referrer.kind}</strong> · Status: <strong>{referrer.status}</strong></p>
            <p>Your code: <strong>{referrer.code}</strong></p>
            {referrer.status==="approved" ?
              <><label htmlFor="my-ref-link">Your shareable link</label>
                <input id="my-ref-link" className={styles.input} readOnly value={`${origin}/ref/${referrer.code}`} />
                <p>Share this link with people who have never purchased from BirdShop before.</p></> :
              <p>Your link will become active after approval. You cannot earn rewards while pending, rejected or suspended.</p>}
          </section>
          <section className={styles.panel}>
            <h2>Referred buyers</h2>
            <p><strong>{creditedBuyers.size}</strong> verified qualifying buyer{creditedBuyers.size === 1 ? "" : "s"} recorded.</p>
            <p className={styles.disclaimer}>Paid first purchases are counted only once. Verified buyer credit does not mean the $0.50 reward is approved or payable.</p>
          </section>
          <section className={styles.panel}>
            <h2>Earnings</h2>
            <div className={styles.earnings}>
              <div><small>Pending review</small><h3>{currency(sum(pending))}</h3></div>
              <div><small>Approved / unpaid</small><h3>{currency(sum(approved))}</h3></div>
              <div><small>Recorded as paid</small><h3>{currency(sum(paid))}</h3></div>
            </div>
            <h3>Recent reward activity</h3>
            {rewards.length===0 ? <p>No qualifying referrals recorded yet.</p> :
              <ul className={styles.activity}>{rewards.map((r,i)=><li key={i}>
                {new Date(r.created_at).toLocaleDateString("en-US")} — {currency(r.amount_cents)} — {r.status.replaceAll("_"," ")}
              </li>)}</ul>}
            <p className={styles.disclaimer}>Amounts are USD. Only the 100 newest reward records are displayed. Referrals must be reviewed before payment.</p>
          </section>
        </>}
      </>}
    </div>
    <SiteFooter />
  </main>;
}
