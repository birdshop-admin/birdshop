"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useCart } from "@/app/cart-context";
import PublicServiceChatNotifier from "@/components/PublicServiceChatNotifier";
import { CartIcon } from "@/components/SiteIcons";
import { siteConfig } from "@/lib/site-config";

export default function SiteHeader() {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function updateHeader() {
      const next = window.scrollY >= 15;
      setScrolled((current) =>
        current === next ? current : next
      );
    }

    updateHeader();

    window.addEventListener("scroll", updateHeader, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", updateHeader);
    };
  }, []);

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }

  return (
    <>
      <PublicServiceChatNotifier />

      <header
        className={`site-header ${
          scrolled ? "site-header-scrolled" : ""
        } ${menuOpen ? "site-header-menu-open" : ""}`}
      >
        <Link
          href="/"
          className="site-header-brand"
          aria-label={`${siteConfig.name} home`}
        >
          <span className="site-header-bs">BS</span>
          <span className="site-header-brand-rule" />
          <span className="site-header-brand-word">
            {siteConfig.displayName}
          </span>
        </Link>

        <nav
          className="site-header-nav"
          aria-label="Primary navigation"
        >
          {siteConfig.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive(item.href)
                  ? "site-header-active"
                  : ""
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="site-header-menu-toggle"
          aria-label={
            menuOpen
              ? "Close navigation"
              : "Open navigation"
          }
          aria-expanded={menuOpen}
          aria-controls="birdshop-mobile-navigation"
          onClick={() =>
            setMenuOpen((open) => !open)
          }
        >
          <span
            className="site-header-menu-icon"
            aria-hidden="true"
          >
            <i />
            <i />
          </span>

          <span>Menu</span>
        </button>

        <Link
          href="/cart"
          className="site-header-cart"
          aria-label={`Open cart with ${totalItems} item${
            totalItems === 1 ? "" : "s"
          }`}
        >
          <span className="site-header-cart-icon">
            <CartIcon />
          </span>

          <span className="site-header-cart-count">
            {totalItems}
          </span>
        </Link>

        <nav
          id="birdshop-mobile-navigation"
          className="site-header-mobile-nav"
          aria-label="Mobile navigation"
          aria-hidden={!menuOpen}
        >
          {siteConfig.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive(item.href)
                  ? "site-header-mobile-active"
                  : ""
              }
              onClick={() => setMenuOpen(false)}
            >
              <span>{item.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
