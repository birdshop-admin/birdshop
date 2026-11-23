import Link from "next/link";
import { getAuthenticatedMarketplaceUser } from "@/lib/marketplace";
import { sendSellerLogin,verifySellerLoginCode,signOutSeller } from "@/app/sell/actions";
import styles from "@/app/marketplace/marketplace.module.css";
export const dynamic="force-dynamic";
const notices:Record<string,string>={"check-email":"Check your email for a sign-in link or enter your verification code below.","invalid-email":"Enter a valid email address.","invalid-code":"That code could not be verified. Request a new code and try again.","login-unavailable":"Sign-in is temporarily unavailable. Please try again.","sign-in-required":"Sign in to view your marketplace orders, messages, and account."};
export default async function Account({searchParams}:{searchParams:Promise<{notice?:string}>}){
 const user=await getAuthenticatedMarketplaceUser();const {notice}=await searchParams;
 return <main id="site-content" className={styles.shell}><div className={styles.wrap}>
  <header className={styles.hero}><span className={styles.eyebrow}>YOUR BIRDSHOP MARKETPLACE</span><h1>{user?"Welcome back.":"Your next find awaits."}</h1><p>One account for your marketplace orders, conversations, and seller workspace.</p></header>
  <div className={styles.stack}>{notice&&notices[notice]&&<p role="status" className={styles.notice}>{notices[notice]}</p>}
  {user?<section className={styles.card}><h2>Your marketplace account</h2><p>Signed in as {user.email}</p><div className={styles.actions}><Link className={styles.button} href="/marketplace/orders">My orders</Link><Link className={styles.outline} href="/marketplace/messages">My messages</Link><Link className={styles.outline} href="/sell">Sell on BirdShop</Link></div><form action={signOutSeller} style={{marginTop:24}}><button className={styles.outline}>Sign out</button></form></section>:
  <section className={styles.card} style={{maxWidth:650}}><h2>Sign in with email</h2><p>No password to remember. We’ll send a secure link and verification code.</p>
    <form action={sendSellerLogin}><input type="hidden" name="intent" value="buyer"/><label className={styles.label} htmlFor="buyer-email">Email address</label><input className={styles.field} id="buyer-email" name="email" type="email" autoComplete="email" required/><button className={styles.button} style={{marginTop:16}}>Send sign-in email</button></form>
    <details style={{marginTop:24}}><summary>Already have a verification code?</summary><form action={verifySellerLoginCode}><input type="hidden" name="intent" value="buyer"/><label className={styles.label} htmlFor="code-email">Email address</label><input className={styles.field} id="code-email" name="email" type="email" required/><label className={styles.label} htmlFor="buyer-code">Verification code</label><input className={styles.field} id="buyer-code" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" required/><button className={styles.button} style={{marginTop:16}}>Verify and sign in</button></form></details>
  </section>}
  </div></div></main>;
}
