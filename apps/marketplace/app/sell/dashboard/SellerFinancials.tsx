import Link from "next/link";
import type { SellerProfile } from "@/lib/marketplace";
import { marketplaceMoney } from "@/lib/marketplace";
import { SELLER_TIERS, tierProgress } from "@/lib/seller-tiers";
import { eligibleConnectCountries, type ConnectMapping } from "@/lib/stripe-connect";
import { onboardSellerConnect } from "@/app/sell/connect/actions";
import styles from "@/app/marketplace/marketplace.module.css";
type Transaction = { id: string; state: string; subtotal_cents: number; commission_cents: number;
  commission_bps: number; refunded_cents: number; stripe_dispute_status: string | null;
  fraudulent: boolean; listing_title: string | null; created_at: string };
export function SellerFinancials({ profile, connect, balance, stripeUnavailable, orders }: {
  profile: SellerProfile; connect: ConnectMapping | null;
  balance: { pending: number; available: number } | null; stripeUnavailable: boolean; orders: Transaction[];
}) {
  const progress = tierProgress(profile.earned_tier, Number(profile.qualifying_sales_cents), profile.partner_approved);
  const notices = orders.filter(o => o.refunded_cents > 0 || o.stripe_dispute_status || o.fraudulent);
  let countries: string[] = [];
  let countryConfigurationMissing = false;
  if (!connect) {
    try { countries = eligibleConnectCountries(); } catch { countryConfigurationMissing = true; }
  }
  const status = stripeUnavailable ? "Status temporarily unavailable" : !connect?.stripe_account_id ? "Not connected" :
    connect.closed ? "Account closed" : connect.transfers_status === "active" ? "Ready to receive transfers" : "Verification required";
  return <>
    <div className={styles.kpis}>
      <div className={styles.kpi}><span>Current tier</span><strong>{progress.current.name}</strong>
        <p className={styles.small}>{(profile.commission_bps/100).toFixed(2)}% effective commission{profile.commission_override_bps !== null ? " · Owner override" : ""}</p></div>
      <div className={styles.kpi}><span>Pending earnings · USD</span><strong>{(stripeUnavailable || (connect?.stripe_account_id && !balance)) ? "Unavailable" : marketplaceMoney(balance?.pending ?? 0)}</strong>
        <p className={styles.small}>Payments clearing in your Stripe balance</p></div>
      <div className={styles.kpi}><span>Available earnings · USD</span><strong>{(stripeUnavailable || (connect?.stripe_account_id && !balance)) ? "Unavailable" : marketplaceMoney(balance?.available ?? 0)}</strong>
        <p className={styles.small}>Stripe balance available for payout</p></div>
    </div>
    <div className={styles.financeGrid}>
      <section className={`${styles.card} ${styles.tierCard}`} aria-labelledby="seller-tier-heading">
        <span className={styles.eyebrow}>YOUR NEXT MILESTONE</span>
        <h2 id="seller-tier-heading">Every completed sale counts.</h2>
        <p className={styles.financeAmount}>{marketplaceMoney(profile.qualifying_sales_cents)}</p>
        <p>Total qualifying completed sales · USD</p>
        {progress.next ? <>
          <label className={styles.label} htmlFor="tier-progress">Progress to {progress.next.name} · {Math.floor(progress.percent)}%</label>
          <progress className={styles.progress} id="tier-progress" max="100" value={progress.percent}/>
          <p><strong>{marketplaceMoney(progress.remaining)}</strong> remaining to unlock {progress.next.bps/100}% commission.</p>
        </> : <p>{profile.partner_approved ? "Partner pricing approved by BirdShop's owner." : "You have earned the highest automatic tier. Partner pricing is available by owner approval."}</p>}
        <div className={styles.tierSteps}>{SELLER_TIERS.map(t => <div key={t.key} aria-current={t.key===progress.current.key ? "step" : undefined}>
          <span>{t.name}</span><strong>{t.bps/100}%</strong><small>{t.threshold === null ? "Owner approval" : t.threshold === 0 ? "Start here" : marketplaceMoney(t.threshold)}</small>
        </div>)}</div>
        <p className={styles.small}>Only verified, completed sales qualify. Refunds reduce qualifying volume and fraud or disputed sales are excluded. Earned tiers are retained.</p>
      </section>
      <section className={styles.card} aria-labelledby="connect-heading">
        <span className={styles.eyebrow}>PAYMENT VERIFICATION</span><h2 id="connect-heading">Stripe Connect</h2>
        <p><span className={styles.status}>{status}</span></p>
        <p>Verify your identity and payout details securely with Stripe. Create and manage all your products and services here in BirdShop.</p>
        {connect?.country && <p>Account country: {connect.country}</p>}
        {stripeUnavailable && <p role="status">We couldn&apos;t refresh your Stripe account. Reload to try again. Balances and verification details may be out of date.</p>}
        {connect?.requirements?.length ? <><h3>Outstanding verification</h3><ul>
          {connect.requirements.map((r, i) => <li key={i}>{r.description.replaceAll("_", " ")} · {r.deadline.replaceAll("_", " ")}
            {r.awaiting === "stripe" ? " · Under Stripe review" : " · Action needed"}
            {r.errors.map((e, j) => <p key={j}>{e}</p>)}</li>)}
        </ul></> : connect?.stripe_account_id && <p>No outstanding verification requirements in the latest account status.</p>}
        {!!connect?.future_requirements?.length && <details><summary>Upcoming verification requirements</summary><ul>
          {connect.future_requirements.map((r, i) => <li key={i}>{r.description.replaceAll("_", " ")}</li>)}
        </ul></details>}
        {!connect?.closed && !countryConfigurationMissing && <form action={onboardSellerConnect}>
          {!connect && <><label className={styles.label} htmlFor="seller-country">Your legal account country</label>
            <select className={styles.field} id="seller-country" name="country" defaultValue="" required>
              <option value="" disabled>Select your actual country</option>{countries.map(c => <option key={c} value={c}>{new Intl.DisplayNames(["en"], { type: "region" }).of(c)}</option>)}
            </select><p className={styles.small}>Use the country where you or your business is legally established. This is verified by Stripe.</p></>}
          <button className={styles.button}>{connect?.stripe_account_id ? "Review verification details" : "Connect with Stripe"}</button>
        </form>}
        {countryConfigurationMissing && <p role="status">Seller payment onboarding is being configured. Contact BirdShop for availability.</p>}
        <p className={styles.small}>Sandbox mode · Test payments only. Stripe controls balance availability and payout timing. Balances are shown in USD after Stripe adjustments and fees.</p>
      </section>
    </div>
    {!!notices.length && <section className={styles.notice} aria-label="Refund and dispute notices"><strong>Refund and dispute notices</strong>
      {notices.map(o => <p key={o.id}>{o.listing_title || `Order ${o.id.slice(0,8)}`}: {o.refunded_cents>0 && `${marketplaceMoney(o.refunded_cents)} refunded. `}
        {o.stripe_dispute_status && `Payment dispute: ${o.stripe_dispute_status.replaceAll("_", " ")}. `}{o.fraudulent && "Payment flagged for fraud review."}</p>)}
    </section>}
    <section className={styles.card} aria-labelledby="recent-marketplace-transactions"><h2 id="recent-marketplace-transactions">Recent transactions</h2>
      {!orders.length ? <p>No marketplace transactions yet. Publish an approved listing to get started.</p> :
        <div className={styles.tableScroll}><table className={styles.table}>
          <caption className={styles.small}>Original order amounts and fee snapshots. Refunds are shown separately below each sale.</caption>
          <thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Sale</th><th scope="col">BirdShop fee</th><th scope="col">Seller allocation</th></tr></thead>
          <tbody>{orders.map(o => <tr key={o.id}><td>{o.listing_title || o.id.slice(0,8)}<br/><small>{new Date(o.created_at).toLocaleDateString("en-US")}</small>
            {o.refunded_cents>0 && <p className={styles.small}>Refunded {marketplaceMoney(o.refunded_cents)}</p>}</td>
            <td>{o.state.replaceAll("_", " ")}</td><td>{marketplaceMoney(o.subtotal_cents)}</td>
            <td>{marketplaceMoney(o.commission_cents)}<br/><small>{(o.commission_bps/100).toFixed(2)}%</small></td>
            <td>{marketplaceMoney(o.subtotal_cents-o.commission_cents)}<br/><small>before processing fees</small></td></tr>)}</tbody>
        </table></div>}
      <p><Link href="/sell/orders">View all orders and fulfillment →</Link></p>
    </section>
  </>;
}
