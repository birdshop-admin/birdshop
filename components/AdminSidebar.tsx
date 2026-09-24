"use client";

import Image from "next/image";
import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import AdminLogoutButton from "@/components/AdminLogoutButton";

import styles from "./AdminSidebar.module.css";

const navigation = [
  {
    label: "Overview",
    href: "/admin",
  },

  {
    label: "Products",
    href: "/admin/products",
  },

  {
    label: "Inventory",
    href: "/admin/inventory",
  },

  {
    label: "Orders",
    href: "/admin/orders",
  },

  {
    label: "Chat",
    href: "/admin/chat",
  },

  {
    label: "Support",
    href: "/admin/requests",
  },

  {
    label: "Reviews",
    href: "/admin/reviews",
  },
];

function isActive(
  pathname: string,
  href: string
) {
  if (
    href === "/admin"
  ) {
    return (
      pathname ===
      "/admin"
    );
  }

  return (
    pathname ===
      href ||
    pathname.startsWith(
      `${href}/`
    )
  );
}

export default function AdminSidebar() {
  const pathname =
    usePathname();

  return (
    <aside
      className={
        styles.sidebar
      }
    >
      <Link
        href="/admin"
        className={
          styles.brand
        }
      >
        <Image
          src="/greenbs.png"
          alt="BirdShop"
          width={46}
          height={46}
          priority
        />

        <div>
          <strong>
            BIRDSHOP
          </strong>

          <span>
            ADMINISTRATION
          </span>
        </div>
      </Link>

      <nav
        className={
          styles.nav
        }
      >
        <span
          className={
            styles.navLabel
          }
        >
          MANAGEMENT
        </span>

        {navigation.map(
          (
            item
          ) => {
            const active =
              isActive(
                pathname,
                item.href
              );

            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                className={
                  active
                    ? styles.active
                    : styles.navLink
                }
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
              >
                {
                  item.label
                }
              </Link>
            );
          }
        )}
      </nav>

      <div
        className={
          styles.bottom
        }
      >
        <Link
          href="/"
          className={
            styles.storeLink
          }
        >
          ← View Store
        </Link>

        <div
          className={
            styles.logout
          }
        >
          <AdminLogoutButton />
        </div>
      </div>
    </aside>
  );
}