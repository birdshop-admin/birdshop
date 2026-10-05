"use client";
import Link from "next/link";
import { useAdminReport } from "./useAdminReport";
import {
  formatCount as count,
  formatMoney as money,
  statusText,
  type Overview,
} from "@/lib/admin-reporting";
import s from "./AdminReports.module.css";
export default function AdminOverview() {
  const { data: d, error } = useAdminReport<Overview>(
    "birdshop_admin_overview",
  );
  if (!d)
    return (
      <section className={s.panel} aria-busy={!error}>
        <h2>Your store at a glance</h2>
        <p role={error ? "alert" : "status"}>
          {error || "Loading your operations…"}
        </p>
      </section>
    );
  const attention = [
    {
      label: "Chats awaiting a reply",
      count: d.awaiting_reply,
      href: "/admin/chat",
    },
    {
      label: "Delivery / fulfillment issues",
      count: d.delivery_issues,
      href: "/admin/orders?view=digital",
    },
    {
      label: "Email jobs need attention",
      count: d.email_issues,
      href: "/admin/settings",
    },
    {
      label: "Payments need reconciliation",
      count: d.payment_issues,
      href: "/admin/settings",
    },
    {
      label: "Products low on stock",
      count: d.low_stock_count,
      href: "/admin/inventory",
    },
  ].filter((x) => Number(x.count) > 0);
  return (
    <div className={s.report}>
      {error && (
        <p className={s.error} role="alert">
          {error} Last successful figures remain visible.
        </p>
      )}
      <div className={s.metrics}>
        <article className={s.primary}>
          <span>Lifetime net revenue</span>
          {d.revenue.length ? (
            d.revenue.map((r) => (
              <strong key={r.currency}>{money(r.net, r.currency)}</strong>
            ))
          ) : (
            <strong>—</strong>
          )}
          <small>
            {d.revenue.length
              ? "Confirmed payments less refunds"
              : "No confirmed payments yet"}
          </small>
        </article>
        {[
          ["Paid orders", d.paid_orders, "Historical real purchases"],
          ["Products sold", d.units, "Paid digital units, including refunds"],
          ["Live now", d.live_now, "Anonymous browsers · last 2 minutes"],
        ].map(([label, n, note]) => (
          <article key={String(label)}>
            <span>{label}</span>
            <strong>{count(Number(n))}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <div className={s.columns}>
        <section className={s.panel}>
          <div className={s.heading}>
            <div>
              <span className={s.eyebrow}>YOUR NEXT STEPS</span>
              <h2>Needs attention</h2>
            </div>
            <Link href="/admin/settings">Recovery tools →</Link>
          </div>
          {attention.length ? (
            <div className={s.rows}>
              {attention.map((a) => (
                <Link className={s.actionRow} key={a.label} href={a.href}>
                  <span>{a.label}</span>
                  <b>{count(a.count)} →</b>
                </Link>
              ))}
            </div>
          ) : (
            <div className={s.empty}>
              <h3>Everything is running normally</h3>
              <p>No outstanding issues were found in the monitored queues.</p>
            </div>
          )}
        </section>
        <section className={s.panel}>
          <div className={s.heading}>
            <div>
              <span className={s.eyebrow}>SERVICE DESK</span>
              <h2>Conversations & work</h2>
            </div>
            <Link href="/admin/chat">Open chat →</Link>
          </div>
          <dl className={s.facts}>
            {[
              ["Open conversations", d.open_chats],
              ["Awaiting your reply", d.awaiting_reply],
              ["Assigned conversations", d.assigned_chats],
              ["Paid services in progress", d.paid_services],
              ["Digital deliveries pending", d.pending_digital],
            ].map(([label, n]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{count(Number(n))}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section className={s.panel}>
        <div className={s.heading}>
          <div>
            <span className={s.eyebrow}>LATEST PURCHASES</span>
            <h2>Recent paid orders</h2>
          </div>
          <Link href="/admin/orders">View all →</Link>
        </div>
        {d.recent_orders.length ? (
          <div className={s.orders}>
            {d.recent_orders.map((o) => (
              <Link
                className={s.order}
                href={
                  "/admin/orders?view=" +
                  (o.order_type === "product" ? "digital" : "services")
                }
                key={o.reference}
              >
                <div>
                  <strong>{o.reference}</strong>
                  <small>{o.customer_name}</small>
                </div>
                <div>
                  <span>
                    {o.order_type === "product" ? "Digital" : "Service"} ·{" "}
                    {statusText(o.payment_status)}
                  </span>
                  <small>
                    {o.order_type === "product"
                      ? "Delivery: " + statusText(o.delivery_status)
                      : "Work: " + statusText(o.order_status)}
                  </small>
                </div>
                <div>
                  <strong>{money(o.total, o.currency)}</strong>
                  <small>{new Date(o.paid_at).toLocaleDateString()}</small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className={s.empty}>
            Paid orders will appear here after payment confirmation.
          </p>
        )}
      </section>
      <div className={s.columns}>
        <section className={s.panel}>
          <div className={s.heading}>
            <div>
              <span className={s.eyebrow}>DIGITAL STOCK</span>
              <h2>Inventory</h2>
            </div>
            <Link href="/admin/inventory">Manage →</Link>
          </div>
          <div className={s.stock}>
            {Object.entries(d.inventory).map(([label, n]) => (
              <div key={label}>
                <strong>{count(n)}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          {d.low_stock.length ? (
            <>
              <p>Visible products with 3 or fewer available codes</p>
              {d.low_stock.map((p) => (
                <div className={s.actionRow} key={p.name}>
                  <span>{p.name}</span>
                  <b>{count(p.available)} left</b>
                </div>
              ))}
            </>
          ) : (
            <p className={s.empty}>No visible products are low on stock.</p>
          )}
        </section>
        <section className={s.panel}>
          <div className={s.heading}>
            <div>
              <span className={s.eyebrow}>ACROSS YOUR STORE</span>
              <h2>Recent activity</h2>
            </div>
          </div>
          {d.activity.length ? (
            <ol className={s.activity}>
              {d.activity.map((a, i) => (
                <li key={a.kind + a.occurred_at + i}>
                  <Link href={a.href}>
                    <strong>{a.title}</strong>
                    <span>{statusText(a.detail)}</span>
                  </Link>
                  <time dateTime={a.occurred_at}>
                    {new Date(a.occurred_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className={s.empty}>
              New conversations, payments, and reviews will appear here.
            </p>
          )}
        </section>
      </div>
      <footer className={s.foot}>
        Updated {new Date(d.updated_at).toLocaleTimeString()} · Refreshes while
        visible. Revenue stays separated by currency.{" "}
        <Link href="/admin/analytics">Explore performance over time →</Link>
      </footer>
    </div>
  );
}
