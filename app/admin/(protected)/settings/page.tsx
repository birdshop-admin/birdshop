import SubmitButton from "@/components/SubmitButton";
import { formatUSD } from "@/lib/money";
import { configurationChecks } from "@/lib/deployment-config";
import AdminSidebar from "@/components/AdminSidebar";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import { requireOwner } from "@/lib/staff-auth";
import {
  retryBackgroundWork,
  reconcileSavedCheckout,
  resendReviewedEmail,
  retryProductDelivery,
} from "./actions";
import styles from "../admin.module.css";
import local from "./settings.module.css";
type Job = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  provider_id: string | null;
};
type Health = {
  email_jobs: Job[];
  pending_events: number;
  checkouts_needing_attention: number;
  checkouts: {
    id: string;
    kind: string;
    status: string;
    stripe_session_id: string | null;
    created_at: string;
    expires_at: string;
  }[];
  audit: { action: string; entity_id: string; created_at: string }[];
};
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const { supabase, profile } = await requireOwner();
  const { data, error } = await supabase.rpc("birdshop_v2_admin_health");
  const health = data as Health | null;
  // Paid digital orders whose codes have not been delivered yet.
  const { data: deliveryData } = await supabase
    .from("orders")
    .select("id,reference,customer_name,total,currency,delivery_status,fulfillment_status,paid_at")
    .eq("order_type", "product")
    .in("payment_status", ["paid", "partially_refunded"])
    .or("delivery_status.is.null,delivery_status.not.in.(sent,cancelled)")
    .is("deleted_at", null)
    .or("source.is.null,source.neq.admin_test")
    .order("paid_at", { ascending: false })
    .limit(50);
  const deliveries = (deliveryData ?? []) as {
    id: string;
    reference: string;
    customer_name: string | null;
    total: number | string;
    currency: string;
    delivery_status: string | null;
    fulfillment_status: string | null;
    paid_at: string | null;
  }[];
  return (
    <main className={styles.page}>
      <AdminSidebar />
      <section className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <span>ADMINISTRATION</span>
            <h1>Settings & delivery</h1>
            <p>Session controls, payment retries and notification status.</p>
          </div>
        </header>
        <details>
          <summary>Server configuration checks</summary>
          <p>Names and validation status only. Keys are never displayed.</p>
          <ul>
            {configurationChecks().map((check) => (
              <li key={check.name}>
                {check.name}: {check.status}
              </li>
            ))}
          </ul>
        </details>
        {notice && <p role="status">{notice}</p>}
        <div className={local.cards}>
          <article>
            <h2>{profile.display_name || "Owner"}</h2>
            <p>
              This browser session stays signed in during inactivity and
              refreshes. Use Sign out on shared devices.
            </p>
            <AdminLogoutButton />
          </article>
          <article>
            <h2>Background delivery</h2>
            <p>
              {health
                ? `${health.pending_events} pending payment events · ${health.checkouts_needing_attention} checkouts need review`
                : "Status unavailable"}
            </p>
            <form action={retryBackgroundWork}>
              <SubmitButton>Run retries now</SubmitButton>
            </form>
            <small>
              Automatic retries also require the scheduled maintenance endpoint
              described in the installation guide.
            </small>
          </article>
        </div>
        {error && (
          <p role="alert">
            Status could not be loaded. Confirm that the current migrations are
            installed.
          </p>
        )}
        <section className={local.section} id="deliveries">
          <h2>Digital deliveries needing attention</h2>
          <p>
            Paid digital orders whose codes have not been emailed yet. Delivery
            normally happens within minutes of payment; retry here after adding
            stock or after checking the email provider.
          </p>
          <div className={local.jobs}>
            {deliveries.map((order) => (
              <article key={order.id}>
                <div>
                  <strong>
                    {order.reference} · {order.customer_name || "Customer"}
                  </strong>
                  <span>{(order.delivery_status ?? "pending").replaceAll("_", " ")}</span>
                </div>
                <small>
                  {formatUSD(order.total)} ·{" "}
                  {order.paid_at ? new Date(order.paid_at).toLocaleString() : ""}
                </small>
                <form action={retryProductDelivery}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <label>
                    <input type="checkbox" name="reviewed" value="yes" /> I checked
                    email-provider history if delivery is uncertain.
                  </label>
                  <SubmitButton>Retry allocation / delivery</SubmitButton>
                </form>
              </article>
            ))}
            {deliveries.length === 0 && <p>All paid digital orders have been delivered.</p>}
          </div>
        </section>
        <section className={local.section}>
          <h2>Pending checkouts</h2>
          <p>
            For a lost checkout response, find its attempt ID in Stripe metadata
            and enter the matching Checkout Session ID. Its amount and identity
            are verified before any order or stock changes.
          </p>
          <div className={local.jobs}>
            {health?.checkouts.map((attempt) => (
              <article key={attempt.id}>
                <strong>
                  {attempt.kind} · {attempt.status}
                </strong>
                <code>{attempt.id}</code>
                <small>{new Date(attempt.created_at).toLocaleString()}</small>
                <form action={reconcileSavedCheckout}>
                  <input type="hidden" name="attemptId" value={attempt.id} />
                  <label>
                    Stripe Checkout Session ID
                    <input
                      name="sessionId"
                      placeholder="cs_… (optional for automatic lookup)"
                      defaultValue={attempt.stripe_session_id ?? ""}
                      maxLength={255}
                    />
                  </label>
                  <SubmitButton>Reconcile with Stripe</SubmitButton>
                </form>
              </article>
            ))}
            {health?.checkouts.length === 0 && <p>No unresolved checkouts.</p>}
          </div>
        </section>
        <section className={local.section}>
          <h2>Recent email jobs</h2>
          <p>
            “Sent” means the email provider accepted the message. “Attention”
            requires checking the provider’s delivery history before any resend.
          </p>
          <div className={local.jobs}>
            {health?.email_jobs.map((j) => (
              <article key={j.id}>
                <div>
                  <strong>{j.kind.replaceAll("_", " ")}</strong>
                  <span>{j.status}</span>
                </div>
                <small>
                  {new Date(j.created_at).toLocaleString()} · {j.attempts}{" "}
                  attempts
                </small>
                {j.last_error && <p>{j.last_error}</p>}
                {j.provider_id && <code>{j.provider_id}</code>}
                {j.status === "attention" && (
                  <form action={resendReviewedEmail}>
                    <input type="hidden" name="jobId" value={j.id} />
                    <label>
                      <input
                        type="checkbox"
                        name="reviewed"
                        value="yes"
                        required
                      />
                      I checked the provider delivery history and want to send a
                      replacement email.
                    </label>
                    <SubmitButton>Queue replacement email</SubmitButton>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
        <section className={local.section}>
          <h2>Recent protected actions</h2>
          <div className={local.jobs}>
            {health?.audit.map((a, i) => (
              <article key={i}>
                <strong>{a.action.replaceAll("_", " ")}</strong>
                <small>{new Date(a.created_at).toLocaleString()}</small>
                <code>{a.entity_id}</code>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
