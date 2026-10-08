"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { useCart } from "@/app/cart-context";
import PublicServiceChatNotifier from "@/components/PublicServiceChatNotifier";
import { CartIcon } from "@/components/SiteIcons";
import { siteConfig } from "@/lib/site-config";
import ThemeToggle from "@/components/ThemeToggle";

export default function SiteHeader() {
  const pathname = usePathname();
  const { totalItems, productsLoaded } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  // Last count seen by this header. A remount starts from the current value,
  // so the bump never fires on hydration or page navigation.
  const previousCount = useRef({
    count: totalItems,
    loaded: productsLoaded,
  });

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

  // Escape (returning focus to the toggle) or a press outside the header closes
  // the mobile menu, matching standard disclosure behaviour.
  useEffect(() => {
    if (!menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setMenuOpen(false);
      toggleRef.current?.focus();
    }

    function closeOnOutsidePress(event: PointerEvent) {
      const header = headerRef.current;

      if (
        header &&
        event.target instanceof Node &&
        !header.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePress);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
    };
  }, [menuOpen]);

  // A small bump when items are added. Web Animations only: no state, no reflow.
  useEffect(() => {
    const previous = previousCount.current;

    if (
      previous.loaded &&
      productsLoaded &&
      totalItems > previous.count &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      countRef.current?.animate?.(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.22)" },
          { transform: "scale(1)" },
        ],
        {
          duration: 420,
          easing: "cubic-bezier(0.3, 1.5, 0.5, 1)",
        },
      );
    }

    previousCount.current = {
      count: totalItems,
      loaded: productsLoaded,
    };
  }, [totalItems, productsLoaded]);

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }

  const cartLabel = productsLoaded
    ? `Open cart with ${totalItems} item${totalItems === 1 ? "" : "s"}`
    : "Open cart";

  return (
    <>
      <PublicServiceChatNotifier />

      <a className="site-skip-link" href="#site-content">
        Skip to content
      </a>

      <header
        id="site-top"
        ref={headerRef}
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
          {siteConfig.navigation.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "site-header-active" : ""}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className="site-header-menu-toggle"
          aria-label={
            menuOpen
              ? "Close menu"
              : "Open menu"
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

        <div className="site-header-actions">
          <ThemeToggle placement="header" />

          <Link
            href="/cart"
            className="site-header-cart"
            aria-label={cartLabel}
          >
            <span className="site-header-cart-icon">
              <CartIcon />
            </span>

            {/* Blank until the saved cart is read, so it never flashes 0. */}
            <span
              ref={countRef}
              className="site-header-cart-count"
            >
              {productsLoaded ? totalItems : ""}
            </span>
          </Link>
        </div>

        <nav
          id="birdshop-mobile-navigation"
          className="site-header-mobile-nav"
          aria-label="Mobile navigation"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
        >
          {siteConfig.navigation.map((item, index) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "site-header-mobile-active" : ""}
                aria-current={active ? "page" : undefined}
                style={{ "--i": index } as CSSProperties}
                onClick={() => setMenuOpen(false)}
              >
                <span>{item.label}</span>
                <span aria-hidden="true">→</span>
              </Link>
            );
          })}

          <ThemeToggle placement="menu" />
        </nav>
      </header>

      {/* Skip-link target; focusable so keyboard users land after the header. */}
      <span
        id="site-content"
        className="site-content-anchor"
        tabIndex={-1}
      />
    </>
  );
}
