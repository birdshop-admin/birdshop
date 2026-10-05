"use client";
import { useState } from "react";
import { useAdminReport } from "./useAdminReport";
import {
  formatCount as count,
  formatMoney as money,
  type Report,
} from "@/lib/admin-reporting";
import s from "./AdminReports.module.css";
export default function AdminAnalytics() {
  const [days, setDays] = useState<number | null>(30);
  const { data: d, error } = useAdminReport<Report>(
    "birdshop_admin_report",
    days,
  );
  return (
    <div className={s.report}>
      <section className={s.panel}>
        <div className={s.heading}>
          <div>
            <span className={s.eyebrow}>HISTORICAL PERFORMANCE</span>
            <h2>The bigger picture</h2>
          </div>
          <div className={s.periods} role="group" aria-label="Reporting period">
            {[7, 30, 90, null].map((n) => (
              <button
                key={String(n)}
                aria-pressed={days === n}
                onClick={() => setDays(n)}
              >
                {n === null ? "All time" : n + " days"}
              </button>
            ))}
          </div>
        </div>
        <p>
          All figures below use the selected payment and traffic period.
          Reporting days use UTC.
        </p>
      </section>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {!d ? (
        <section className={s.panel} aria-busy={!error}>
          <p role="status">
            {error
              ? "Figures are currently unavailable."
              : "Loading this period…"}
          </p>
        </section>
      ) : (
        <>
          <div className={s.metrics}>
            {[
              ["Paid orders", d.paid_orders],
              ["Digital units sold", d.units],
              ["Page views", d.views],
              ["Approx. visitors", d.visitors],
            ].map(([label, n]) => (
              <article key={String(label)}>
                <span>{label}</span>
                <strong>{count(Number(n))}</strong>
                <small>
                  {label === "Approx. visitors"
                    ? "Distinct anonymous browser IDs"
                    : "Selected period"}
                </small>
              </article>
            ))}
          </div>
          <section className={s.panel}>
            <div className={s.heading}>
              <div>
                <span className={s.eyebrow}>CONFIRMED SALES</span>
                <h2>Revenue & refunds</h2>
              </div>
            </div>
            {d.revenue.length ? (
              d.revenue.map((r) => (
                <div key={r.currency}>
                  <h3>{r.currency.toUpperCase()}</h3>
                  <div className={s.revenue}>
                    {[
                      ["Gross payments", r.gross],
                      ["Refunds on these payments", r.refunds],
                      ["Net revenue", r.net],
                    ].map(([label, n]) => (
                      <article key={String(label)}>
                        <span>{label}</span>
                        <strong>{money(Number(n), r.currency)}</strong>
                      </article>
                    ))}
                  </div>
                  <dl className={s.facts}>
                    <div>
                      <dt>Average paid order · before refunds</dt>
                      <dd>{money(r.average_order, r.currency)}</dd>
                    </div>
                    <div>
                      <dt>Digital · {count(r.digital_orders)} orders</dt>
                      <dd>{money(r.digital_net, r.currency)} net</dd>
                    </div>
                    <div>
                      <dt>Services · {count(r.service_orders)} orders</dt>
                      <dd>{money(r.service_net, r.currency)} net</dd>
                    </div>
                  </dl>
                  <h3 style={{ marginTop: 24 }}>
                    Net by {d.bucket} · {r.currency}
                  </h3>
                  <div
                    className={s.chart}
                    role="img"
                    aria-label={
                      "Net revenue by " + d.bucket + ". Exact figures follow."
                    }
                  >
                    {d.series.map((row) => {
                      const n = Number(
                        row.revenue.find((x) => x.currency === r.currency)
                          ?.net ?? 0,
                      );
                      const max = Math.max(
                        1,
                        ...d.series.map((x) =>
                          Number(
                            x.revenue.find((v) => v.currency === r.currency)
                              ?.net ?? 0,
                          ),
                        ),
                      );
                      return (
                        <div
                          className={s.bar}
                          key={row.day}
                          title={row.day + ": " + money(n, r.currency)}
                        >
                          <span style={{ height: (n / max) * 100 + "%" }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className={s.chartLabels}>
                    <span>{d.series[0]?.day}</span>
                    <span>{d.series.at(-1)?.day}</span>
                  </div>
                  <details>
                    <summary>Exact revenue figures</summary>
                    <div className={s.detailRows}>
                      {d.series.map((row) => {
                        const v = row.revenue.find(
                          (x) => x.currency === r.currency,
                        );
                        return (
                          <p key={row.day}>
                            <time>{row.day}</time>
                            <span>
                              Gross {money(v?.gross ?? 0, r.currency)} · Refunds{" "}
                              {money(v?.refunds ?? 0, r.currency)} · Net{" "}
                              {money(v?.net ?? 0, r.currency)}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  </details>
                </div>
              ))
            ) : (
              <p className={s.empty}>
                No confirmed sales in this period. Your first payment will
                appear here.
              </p>
            )}
            <p>
              Refunds are the confirmed cumulative refunds attached to payments
              made in this period—not refunds grouped by the date they were
              issued. Archived sales remain included. Currencies are never
              combined.
            </p>
          </section>
          <section className={s.panel}>
            <div className={s.heading}>
              <div>
                <span className={s.eyebrow}>ANONYMOUS TRAFFIC</span>
                <h2>Visits over time</h2>
              </div>
            </div>
            {Number(d.views) > 0 ? (
              <>
                <div
                  className={s.chart}
                  role="img"
                  aria-label="Page views over time. Exact figures follow."
                >
                  {d.series.map((row) => (
                    <div
                      className={s.bar}
                      key={row.day}
                      title={row.day + ": " + row.views + " views"}
                    >
                      <span
                        style={{
                          height:
                            (Number(row.views) /
                              Math.max(
                                1,
                                ...d.series.map((x) => Number(x.views)),
                              )) *
                              100 +
                            "%",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className={s.chartLabels}>
                  <span>{d.series[0]?.day}</span>
                  <span>{d.series.at(-1)?.day}</span>
                </div>
              </>
            ) : (
              <p className={s.empty}>No recorded page views in this period.</p>
            )}
            <details>
              <summary>Exact traffic & sales figures</summary>
              <div className={s.detailRows}>
                {d.series.map((row) => (
                  <p key={row.day}>
                    <time>{row.day}</time>
                    <span>
                      {count(row.views)} views · {count(row.visitors)} visitors
                      · {count(row.paid_orders)} orders · {count(row.units)}{" "}
                      units
                    </span>
                  </p>
                ))}
              </div>
            </details>
            <p>
              Presence heartbeats do not add page views. Visitor counts are
              approximate; one browser identifier may cover multiple visits.
            </p>
          </section>
          <section className={s.panel}>
            <div className={s.heading}>
              <div>
                <span className={s.eyebrow}>DIGITAL CATALOG</span>
                <h2>Top products</h2>
              </div>
            </div>
            {d.products.length ? (
              d.products.map((p, i) => (
                <div
                  className={s.actionRow}
                  key={String(p.product_id) + p.product_name + p.currency}
                >
                  <span>
                    {i + 1}. {p.product_name}
                    <br />
                    <small>{count(p.units)} paid units</small>
                  </span>
                  <b>{money(p.gross, p.currency)}</b>
                </div>
              ))
            ) : (
              <p className={s.empty}>Digital product sales will appear here.</p>
            )}
            <p>
              Revenue uses purchased item snapshots, before refunds. Product
              quantities include historically sold units even when refunded.
              Test orders are excluded.
            </p>
          </section>
          <footer className={s.foot}>
            Updated {new Date(d.updated_at).toLocaleTimeString()} ·{" "}
            {d.bucket === "month"
              ? "All-time charts group by month."
              : "Charts group by day."}
          </footer>
        </>
      )}
    </div>
  );
}
