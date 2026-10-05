"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./AdminAnalytics.module.css";
type Period = "7d" | "30d" | "all";
type Analytics = {
  online_now: number;
  views_7d: number;
  views_30d: number;
  views_all: number;
  visitors_7d: number;
  visitors_30d: number;
  visitors_all: number;
};
type Sales = {
  currency: string;
  gross_revenue: number;
  refunds: number;
  net_revenue: number;
  net_7d: number;
  net_30d: number;
  product_net_revenue: number;
  service_net_revenue: number;
  paid_orders: number;
};
const amount = (value: number, currency: string) =>
  Number(value).toLocaleString("en-US", { style: "currency", currency });
export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<Analytics | null>(null);
  const [sales, setSales] = useState<Sales[]>([]);
  const [sold, setSold] = useState(0);
  const [error, setError] = useState("");
  const [series, setSeries] = useState<
    { day: string; views: number; paid_orders: number; units: number }[]
  >([]);
  const [updated, setUpdated] = useState("");
  useEffect(() => {
    const db = createClient();
    let stopped = false,
      busy = false;
    const refresh = async () => {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const [visitors, revenue, products, timeline] = await Promise.all([
          db.rpc("birdshop_admin_site_analytics"),
          db.rpc("birdshop_v2_sales_stats"),
          db.rpc("birdshop_public_store_stats"),
          db.rpc("birdshop_v2_analytics_series", {
            p_days: period === "7d" ? 7 : 30,
          }),
        ]);
        if (visitors.error || revenue.error || products.error || timeline.error)
          throw new Error(
            "Analytics could not refresh. Previous figures are kept until the next successful update.",
          );
        if (!stopped) {
          setData(
            (Array.isArray(visitors.data)
              ? visitors.data[0]
              : visitors.data) as Analytics,
          );
          setSales(revenue.data as Sales[]);
          setSeries(timeline.data);
          setSold(Number(products.data?.[0]?.products_sold ?? 0));
          setUpdated(
            new Date().toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            }),
          );
          setError("");
        }
      } catch (problem) {
        if (!stopped)
          setError(
            problem instanceof Error
              ? problem.message
              : "Analytics unavailable.",
          );
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [period]);
  return (
    <section className={styles.panel}>
      <header>
        <div>
          <span>STORE ACTIVITY</span>
          <h2>Traffic & revenue</h2>
        </div>
        <div
          className={styles.periods}
          role="group"
          aria-label="Analytics period"
        >
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {p === "all"
                ? "All time"
                : `Last ${p === "7d" ? "7" : "30"} days`}
            </button>
          ))}
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className={styles.grid}>
        <article>
          <span>Live now</span>
          <strong>
            {data ? Number(data.online_now).toLocaleString() : "—"}
          </strong>
          <small>Seen in the last 2 minutes</small>
        </article>
        <article>
          <span>Page views</span>
          <strong>
            {data ? Number(data[`views_${period}`]).toLocaleString() : "—"}
          </strong>
          <small>
            {period === "all"
              ? "Since tracking began"
              : `Last ${period === "7d" ? "7" : "30"} days`}
          </small>
        </article>
        <article>
          <span>Approx. visitors</span>
          <strong>
            {data ? Number(data[`visitors_${period}`]).toLocaleString() : "—"}
          </strong>
          <small>Anonymous browser identifiers</small>
        </article>
        <article>
          <span>Products Sold</span>
          <strong>{data ? sold.toLocaleString() : "—"}</strong>
          <small>All time, including refunded purchases</small>
        </article>
      </div>
      {data && (
        <p>
          Paid Orders ·{" "}
          {sales
            .reduce((n, s) => n + Number(s.paid_orders), 0)
            .toLocaleString()}{" "}
          <small>(all time)</small>
        </p>
      )}
      {sales.map((s) => (
        <div key={s.currency} className={styles.revenue}>
          <article>
            <span>
              {period === "all"
                ? "All-time net revenue"
                : "Net from payments in period"}
            </span>
            <strong>
              {amount(
                period === "all"
                  ? s.net_revenue
                  : period === "7d"
                    ? s.net_7d
                    : s.net_30d,
                s.currency,
              )}
            </strong>
          </article>
          <article>
            <span>All-time payments</span>
            <strong>{amount(s.gross_revenue, s.currency)}</strong>
          </article>
          <article>
            <span>All-time refunds</span>
            <strong>{amount(s.refunds, s.currency)}</strong>
          </article>
          <article>
            <span>Product / service net</span>
            <small>
              {amount(s.product_net_revenue, s.currency)} /{" "}
              {amount(s.service_net_revenue, s.currency)}
            </small>
          </article>
        </div>
      ))}
      {data && (
        <section aria-label="Recorded daily page views">
          <h3>
            Daily page views ·{" "}
            {period === "7d" ? "last 7 days" : "last 30 days"} (UTC)
          </h3>
          <div className={styles.chart}>
            {series.map((row) => (
              <div
                key={row.day}
                className={styles.barColumn}
                title={`${row.day}: ${row.views} views, ${row.paid_orders} orders, ${row.units} products sold`}
              >
                <span
                  style={{
                    height: `${Math.max(1, (Number(row.views) / Math.max(1, ...series.map((r) => Number(r.views)))) * 100)}%`,
                  }}
                />
                <small>{row.day.slice(8)}</small>
              </div>
            ))}
          </div>
          <details>
            <summary>View exact daily figures</summary>
            <div className={styles.dailyRows}>
              {series.map((row) => (
                <p key={row.day}>
                  <time>{row.day}</time>
                  <span>
                    {row.views} views · {row.paid_orders} orders · {row.units}{" "}
                    units
                  </span>
                </p>
              ))}
            </div>
          </details>
        </section>
      )}
      <footer>
        {updated
          ? `Updated ${updated} · Refreshes every 30 seconds while visible.`
          : "Loading activity…"}{" "}
        Test orders are excluded. Archived and deleted orders retain their sales
        history. Period net subtracts refunds from payments made during that
        period.
      </footer>
    </section>
  );
}
