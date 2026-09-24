import Link from "next/link";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  serviceList,
} from "@/lib/services";

import AdminSidebar from "@/components/AdminSidebar";

import styles from "./admin.module.css";

export const dynamic =
  "force-dynamic";

type Analytics = {
  online_now: number;

  views_7d: number;
  views_30d: number;
  views_all: number;

  visitors_7d: number;
  visitors_30d: number;
  visitors_all: number;
};

export default async function AdminPage() {
  const supabase =
    await createClient();

  const {
    data:
      claimsData,
  } =
    await supabase.auth
      .getClaims();

  const userId =
    claimsData
      ?.claims
      ?.sub;

  const [
    userResult,
    adminResult,
    productCountResult,
    pendingReviewsResult,
    openRequestsResult,
    serviceOrdersResult,
    publicStatsResult,
    analyticsResult,
  ] =
    await Promise.all([
      supabase.auth
        .getUser(),

      supabase
        .from(
          "admin_users"
        )
        .select(
          "role, display_name"
        )
        .eq(
          "user_id",
          userId!
        )
        .single(),

      supabase
        .from(
          "products"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head: true,
          }
        ),

      supabase
        .from(
          "reviews"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head: true,
          }
        )
        .eq(
          "status",
          "pending"
        ),

      supabase
        .from(
          "support_requests"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head: true,
          }
        )
        .in(
          "status",
          [
            "open",
            "in_progress",
          ]
        ),

      supabase
        .from(
          "orders"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head: true,
          }
        )
        .eq(
          "order_type",
          "service"
        )
        .is(
          "archived_at",
          null
        )
        .not(
          "service_status",
          "in",
          '("completed","cancelled")'
        ),

      supabase.rpc(
        "birdshop_public_store_stats"
      ),

      supabase.rpc(
        "birdshop_admin_site_analytics"
      ),
    ]);

  const email =
    userResult
      .data
      .user
      ?.email ??
    "Admin";

  const admin =
    adminResult.data;

  const productCount =
    productCountResult
      .count ??
    0;

  const pendingReviews =
    pendingReviewsResult
      .count ??
    0;

  const openRequests =
    openRequestsResult
      .count ??
    0;

  const activeServices =
    serviceOrdersResult
      .count ??
    0;

  const publicStats =
    Array.isArray(
      publicStatsResult.data
    )
      ? publicStatsResult
          .data[0]
      : publicStatsResult.data;

  const productsSold =
    Number(
      publicStats
        ?.products_sold ??
      0
    );

  const analyticsRaw =
    Array.isArray(
      analyticsResult.data
    )
      ? analyticsResult
          .data[0]
      : analyticsResult.data;


  const analyticsReady =
    !analyticsResult.error &&
    !publicStatsResult.error &&
    !serviceOrdersResult.error;
  const analytics: Analytics =
    {
      online_now:
        Number(
          analyticsRaw
            ?.online_now ??
          0
        ),

      views_7d:
        Number(
          analyticsRaw
            ?.views_7d ??
          0
        ),

      views_30d:
        Number(
          analyticsRaw
            ?.views_30d ??
          0
        ),

      views_all:
        Number(
          analyticsRaw
            ?.views_all ??
          0
        ),

      visitors_7d:
        Number(
          analyticsRaw
            ?.visitors_7d ??
          0
        ),

      visitors_30d:
        Number(
          analyticsRaw
            ?.visitors_30d ??
          0
        ),

      visitors_all:
        Number(
          analyticsRaw
            ?.visitors_all ??
          0
        ),
    };

  return (
    <main
      className={
        styles.page
      }
    >
      <AdminSidebar />

      <section
        className={
          styles.content
        }
      >
        <header
          className={
            styles.topbar
          }
        >
          <div>
            <span>
              BIRDSHOP / ADMIN
            </span>

            <h1>
              Dashboard
            </h1>
          </div>

          <div
            className={
              styles.account
            }
          >
            <span>
              {admin?.role ===
              "owner"
                ? "OWNER"
                : "ADMIN"}
            </span>

            <strong>
              {admin
                ?.display_name ??
                "BirdShop Admin"}
            </strong>

            <small>
              {
                email
              }
            </small>
          </div>
        </header>

        {!analyticsReady && (
          <div
            className={
              styles.setupNotice
            }
          >
            Site activity is not fully connected yet. Run
            <strong> supabase/admin-v2-analytics-orders.sql </strong>
            in Supabase, then refresh this page.
          </div>
        )}

        <section
          className={
            styles.welcome
          }
        >
          <div>
            <span>
              OPERATIONS CENTER
            </span>

            <h2>
              BirdShop is online.
            </h2>

            <p>
              Monitor visitors,
              manage service work,
              review sales, control
              inventory, and handle
              support from one place.
            </p>
          </div>

          <div
            className={
              styles.liveStatus
            }
          >
            <span />

            {
              analytics.online_now
            }{" "}
            ONLINE NOW
          </div>
        </section>

        <section
          className={
            styles.primaryStats
          }
        >
          <article>
            <span>
              LIVE NOW
            </span>

            <strong>
              {
                analytics.online_now
              }
            </strong>

            <small>
              ACTIVE VISITORS
            </small>
          </article>

          <article>
            <span>
              PRODUCTS SOLD
            </span>

            <strong>
              {
                productsSold
              }
            </strong>

            <small>
              VERIFIED FULFILLMENT
            </small>
          </article>

          <article>
            <span>
              ACTIVE SERVICES
            </span>

            <strong>
              {
                activeServices
              }
            </strong>

            <small>
              WORK QUEUE
            </small>
          </article>

          <article>
            <span>
              SUPPORT
            </span>

            <strong>
              {
                openRequests
              }
            </strong>

            <small>
              NEEDS ATTENTION
            </small>
          </article>
        </section>

        <section
          className={
            styles.analytics
          }
        >
          <div
            className={
              styles.analyticsHeading
            }
          >
            <div>
              <span>
                WEBSITE ACTIVITY
              </span>

              <h2>
                Traffic overview.
              </h2>
            </div>

            <p>
              Anonymous session
              activity only. No names,
              emails, or IP addresses
              are used for these
              counters.
            </p>
          </div>

          <div
            className={
              styles.analyticsGrid
            }
          >
            <article>
              <span>
                LAST 7 DAYS
              </span>

              <strong>
                {analytics.views_7d.toLocaleString()}
              </strong>

              <p>
                page views
              </p>

              <small>
                {analytics.visitors_7d.toLocaleString()}{" "}
                unique visitors
              </small>
            </article>

            <article>
              <span>
                LAST 30 DAYS
              </span>

              <strong>
                {analytics.views_30d.toLocaleString()}
              </strong>

              <p>
                page views
              </p>

              <small>
                {analytics.visitors_30d.toLocaleString()}{" "}
                unique visitors
              </small>
            </article>

            <article>
              <span>
                ALL TIME
              </span>

              <strong>
                {analytics.views_all.toLocaleString()}
              </strong>

              <p>
                page views
              </p>

              <small>
                {analytics.visitors_all.toLocaleString()}{" "}
                unique visitors
              </small>
            </article>
          </div>
        </section>

        <section
          className={
            styles.quickStats
          }
        >
          <article>
            <span>
              PRODUCTS
            </span>

            <strong>
              {
                productCount
              }
            </strong>
          </article>

          <article>
            <span>
              SERVICES
            </span>

            <strong>
              {
                serviceList.length
              }
            </strong>
          </article>

          <article>
            <span>
              REVIEWS PENDING
            </span>

            <strong>
              {
                pendingReviews
              }
            </strong>
          </article>
        </section>

        <section
          className={
            styles.modules
          }
        >
          <div
            className={
              styles.moduleHeading
            }
          >
            <div>
              <span>
                MANAGEMENT
              </span>

              <h2>
                Admin modules.
              </h2>
            </div>
          </div>

          <div
            className={
              styles.moduleGrid
            }
          >
            <Link
              href="/admin/orders"
              className={
                styles.moduleLink
              }
            >
              <article>
                <span>
                  01
                </span>

                <h3>
                  Orders & Services
                </h3>

                <p>
                  Handle paid service
                  work while digital
                  purchases remain
                  automatic.
                </p>

                <small>
                  OPEN ORDERS →
                </small>
              </article>
            </Link>

            <Link
              href="/admin/inventory"
              className={
                styles.moduleLink
              }
            >
              <article>
                <span>
                  02
                </span>

                <h3>
                  Secure Inventory
                </h3>

                <p>
                  Manage encrypted
                  product keys and
                  real available
                  stock.
                </p>

                <small>
                  OPEN INVENTORY →
                </small>
              </article>
            </Link>

            <Link
              href="/admin/products"
              className={
                styles.moduleLink
              }
            >
              <article>
                <span>
                  03
                </span>

                <h3>
                  Product Management
                </h3>

                <p>
                  Control products,
                  prices, visibility,
                  stock modes, and
                  storefront content.
                </p>

                <small>
                  OPEN PRODUCTS →
                </small>
              </article>
            </Link>

            <Link
              href="/admin/requests"
              className={
                styles.moduleLink
              }
            >
              <article>
                <span>
                  04
                </span>

                <h3>
                  Support Requests
                </h3>

                <p>
                  Product help,
                  general support,
                  and service
                  communication.
                </p>

                <small>
                  OPEN REQUESTS →
                </small>
              </article>
            </Link>

            <Link
              href="/admin/reviews"
              className={
                styles.moduleLink
              }
            >
              <article>
                <span>
                  05
                </span>

                <h3>
                  Review Moderation
                </h3>

                <p>
                  Approve and manage
                  BirdShop community
                  reviews.
                </p>

                <small>
                  OPEN REVIEWS →
                </small>
              </article>
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}