import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedMarketplaceUser, MARKETPLACE_CATEGORIES, getMySellerProfile, type SellerApplication } from "@/lib/marketplace";
import { sendSellerLogin, verifySellerLoginCode, signOutSeller, submitSellerApplication } from "./actions";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Become a seller | BirdShop" };

const messages:Record<string,string> = {
  "check-email":"Check your email for a secure sign-in link or verification code.",
  "invalid-email":"Enter a valid email address.",
  "invalid-code":"That verification code is invalid or expired.",
  "login-unavailable":"Sign-in email could not be sent. Try again later.",
  "sign-in-required":"Verify your email to apply as a seller.",
  "invalid-application":"Check your handle, description, categories and payout preference.",
  "already-applied":"An application is already being reviewed for this account.",
  "handle-taken":"That shop handle is already taken. Choose another.",
  "application-submitted":"Application submitted. Only BirdShop's owner can approve it.",
  "application-required":"An approved active seller account is required.",
};

export default async function SellerRegistration({
  searchParams,
}:{searchParams:Promise<{notice?:string}>}) {
  const { notice } = await searchParams;
  const user = await getAuthenticatedMarketplaceUser();
  let application:SellerApplication|null = null;
  let profile:Awaited<ReturnType<typeof getMySellerProfile>> = null;
  let schemaReady=true;
  if(user){
    const db=createAdminClient();
    const { data,error }=await db.from("birdshop_seller_applications")
      .select("id,user_id,business_name,requested_handle,description,categories,payout_preference,status,review_note,created_at")
      .eq("user_id",user.id).maybeSingle();
    if(error) schemaReady=false;
    else { application=data as SellerApplication|null; profile=await getMySellerProfile(user.id); }
  }

  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">
    <SiteHeader/>
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / MARKETPLACE</span>
        <h1>Sell with BirdShop.</h1>
        <p>Apply for a verified seller storefront. List eligible gaming services and digital products, manage inquiries, and build your own presence within BirdShop.</p>
        <div className={styles.actions}>
          <Link className={styles.outline} href="/marketplace">Explore marketplace</Link>
          {profile && <Link className={styles.button} href="/sell/dashboard">Seller dashboard</Link>}
        </div>
      </header>
      <div className={styles.stack}>
        {notice && messages[notice] && <p role="status" className={styles.notice}>{messages[notice]}</p>}
        {!user ? <div className={styles.split}>
          <section className={styles.card}>
            <h2>Verify your email</h2>
            <p>Use a secure email sign-in. You do not need to create another password.</p>
            <form action={sendSellerLogin}>
              <label className={styles.label} htmlFor="seller-login-email">Email</label>
              <input className={styles.field} id="seller-login-email" name="email"
                type="email" autoComplete="email" maxLength={320} required/>
              <div className={styles.actions}><button className={styles.button} type="submit">Send sign-in email</button></div>
            </form>
            <details style={{marginTop:26}}>
              <summary style={{cursor:"pointer"}}>Have a verification code?</summary>
              <form action={verifySellerLoginCode}>
                <label className={styles.label} htmlFor="seller-otp-email">Email</label>
                <input className={styles.field} type="email" id="seller-otp-email" name="email" required/>
                <label className={styles.label} htmlFor="seller-otp-code">Verification code</label>
                <input className={styles.field} id="seller-otp-code" name="token" inputMode="numeric"
                  pattern="[0-9]{6,8}" required/>
                <button className={styles.button} type="submit">Verify and continue</button>
              </form>
            </details>
          </section>
          <section className={styles.card}>
            <h2>How selling works</h2>
            <ol>
              <li>Verify your identity using your email.</li>
              <li>Submit your shop details and eligible categories.</li>
              <li>Wait for BirdShop owner approval.</li>
              <li>Create listings; every listing is reviewed before publishing.</li>
            </ol>
            <p>Buyer payments, seller earnings and withdrawals will only be enabled after marketplace settlement and payout integrations are approved.</p>
          </section>
        </div> : <>
          <section className={styles.card}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <p style={{margin:0}}>Signed in as <strong>{user.email}</strong></p>
              <form action={signOutSeller}><button className={styles.outline} type="submit">Sign out</button></form>
            </div>
          </section>
          {!schemaReady ? <p role="alert" className={styles.notice}>
            Marketplace setup is not complete. The seller database migration must be applied in the approved environment.
          </p> : profile ? <section className={styles.card}>
            <h2>Your shop is {profile.status}</h2>
            <p>{profile.display_name} · <Link href={`/shops/${profile.handle}`}>birdshop.store/shops/{profile.handle}</Link></p>
            <p>Your commission rate is {(profile.commission_bps/100).toFixed(2)}% on eligible settled sales. Marketplace payments are not enabled yet.</p>
            <Link className={styles.button} href="/sell/dashboard">Open dashboard</Link>
          </section> : application?.status==="pending" ? <section className={styles.card}>
            <h2>Application under review</h2>
            <p>Your application for <strong>{application.business_name}</strong> has been received.</p>
            <p>Requested shop: <strong>{application.requested_handle}</strong> · <span className={styles.status}>Pending owner approval</span></p>
            <p>You will not be able to publish listings until the owner approves your application.</p>
          </section> : <section className={styles.card}>
            <h2>{application?.status==="rejected"?"Reapply as a seller":"Apply for your storefront"}</h2>
            {application?.review_note && <p className={styles.notice}>Previous review: {application.review_note}</p>}
            <form action={submitSellerApplication}>
              <label className={styles.label} htmlFor="seller-business">Storefront / business name</label>
              <input id="seller-business" name="business_name" className={styles.field} minLength={3} maxLength={90} required defaultValue={application?.business_name||""}/>
              <label className={styles.label} htmlFor="seller-handle">Shop URL handle (3–32 characters)</label>
              <input id="seller-handle" className={styles.field} name="handle"
                minLength={3} maxLength={32} pattern="[a-z0-9][a-z0-9-]{2,31}" required
                placeholder="your-shop" defaultValue={application?.requested_handle||""}/>
              <label className={styles.label} htmlFor="seller-about">Your products, experience, delivery method and customer support approach</label>
              <textarea id="seller-about" name="description" className={styles.field} minLength={30} maxLength={1500} required defaultValue={application?.description||""}/>
              <span className={styles.label}>Categories you plan to sell</span>
              <div className={styles.checks}>
                {MARKETPLACE_CATEGORIES.map(category=><label key={category}>
                  <input type="checkbox" name="categories" value={category} defaultChecked={application?.categories.includes(category)||false}/>
                  {category}
                </label>)}
              </div>
              <label className={styles.label} htmlFor="seller-payout">Preferred payout method (preference only, no account details)</label>
              <select id="seller-payout" name="payout_preference" className={styles.field}
                defaultValue={application?.payout_preference||"provider_to_be_approved"}>
                <option value="provider_to_be_approved">Discuss a supported payment provider</option>
                <option value="paypal">PayPal (subject to eligibility)</option>
                <option value="bank">Bank transfer (subject to eligibility)</option>
              </select>
              <p className={styles.small}>Approval is manual. Never send bank login credentials, card numbers, or private documents in this form.</p>
              <button className={styles.button} type="submit">{application ? "Resubmit application":"Submit application"}</button>
            </form>
          </section>}
        </>}
      </div>
    </div>
    <SiteFooter/>
  </main>;
}
