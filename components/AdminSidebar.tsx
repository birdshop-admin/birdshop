"use client";

import Image from "next/image";
import Link from "next/link";

import { usePathname } from "next/navigation";

import AdminLogoutButton from "@/components/AdminLogoutButton";

import styles from "./AdminSidebar.module.css";

/* =========================================================
   TYPES
========================================================= */

export type AdminSidebarRole = "owner" | "service_agent";

type AdminSidebarProps = {
  role?: AdminSidebarRole;
};

/* =========================================================
   OWNER NAVIGATION
========================================================= */

const ownerNavigation = [
  { label: "Overview", href: "/admin" },
  { label: "Chat", href: "/admin/chat" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Products", href: "/admin/products" },
  { label: "Services", href: "/admin/services" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Settings", href: "/admin/settings" },
];

/* =========================================================
   SERVICE AGENT NAVIGATION

   Deliberately tiny.

   No hidden/disabled admin features are displayed.
========================================================= */

const serviceAgentNavigation = [
  {
    label: "Service Chat",

    href: "/admin/chat?view=active&type=service",
  },
];

/* =========================================================
   ACTIVE LINK
========================================================= */

function isActive(
  pathname: string,

  href: string,
) {
  const pathOnly = href.split("?")[0];

  if (pathOnly === "/admin") {
    return pathname === "/admin";
  }

  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

/* =========================================================
   SIDEBAR
========================================================= */

export default function AdminSidebar({ role = "owner" }: AdminSidebarProps) {
  const pathname = usePathname();

  const isServiceAgent = role === "service_agent";

  const navigation = isServiceAgent ? serviceAgentNavigation : ownerNavigation;

  const homeHref = isServiceAgent
    ? "/admin/chat?view=active&type=service"
    : "/admin";

  return (
    <aside className={styles.sidebar}>
      {/* ===================================================
          BRAND
      =================================================== */}

      <Link href={homeHref} className={styles.brand}>
        <Image
          src="/cremebs.png"
          alt="BirdShop"
          width={46}
          height={46}
          priority
        />

        <div>
          <strong>BIRDSHOP</strong>

          <span>{isServiceAgent ? "SERVICE STAFF" : "ADMINISTRATION"}</span>
        </div>
      </Link>

      {/* ===================================================
          NAVIGATION
      =================================================== */}

      <details
        className={styles.mobileMenu}
        onKeyDown={(event) => {
          if (event.key === "Escape")
            event.currentTarget.removeAttribute("open");
        }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a"))
            event.currentTarget.removeAttribute("open");
        }}
      >
        <summary>
          BirdShop ·{" "}
          {navigation.find((item) => isActive(pathname, item.href))?.label ||
            "Admin"}{" "}
          <span>Menu ↓</span>
        </summary>
        <div className={styles.mobileSheet}>
          <nav aria-label="Mobile admin navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  isActive(pathname, item.href) ? "page" : undefined
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className={styles.mobileActions}>
            <Link href="/">View store</Link>
            <AdminLogoutButton />
          </div>
        </div>
      </details>

      <nav className={styles.nav}>
        <span className={styles.navLabel}>
          {isServiceAgent ? "SERVICE DESK" : "MANAGEMENT"}
        </span>

        {navigation.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? styles.active : styles.navLink}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ===================================================
          FOOTER
      =================================================== */}

      <div className={styles.bottom}>
        {!isServiceAgent && (
          <Link href="/" className={styles.storeLink}>
            ← View Store
          </Link>
        )}

        {isServiceAgent && (
          <div className={styles.storeLink}>Service access only</div>
        )}

        <div className={styles.logout}>
          <AdminLogoutButton />
        </div>
      </div>
    </aside>
  );
}
