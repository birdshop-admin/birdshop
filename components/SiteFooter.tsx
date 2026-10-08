import Image from "next/image";
import Link from "next/link";

import {
  DiscordIcon,
  InstagramIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/SiteIcons";
import { hasDiscordInvite, siteConfig } from "@/lib/site-config";

// Only channels that actually exist are shown; greyed "coming soon" icons
// read as unfinished. Without a real invite the Discord URL falls back to the
// Contact page, which a "Discord" icon should not point at.
const socialLinks = [
  {
    label: "Discord",
    href: hasDiscordInvite ? siteConfig.socials.discord : null,
    Icon: DiscordIcon,
  },
  {
    label: "Instagram",
    href: siteConfig.socials.instagram,
    Icon: InstagramIcon,
  },
  {
    label: "YouTube",
    href: siteConfig.socials.youtube,
    Icon: YoutubeIcon,
  },
  {
    label: "X",
    href: siteConfig.socials.x,
    Icon: XIcon,
  },
].flatMap(({ label, href, Icon }) =>
  href ? [{ label, href, Icon }] : [],
);

// Read once per module load, not during render. The footer is also rendered
// inside client pages, so the year text opts out of hydration warnings for the
// rare build-year / visit-year mismatch.
const YEAR = new Date().getFullYear();

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-overlay" />

      <div className="footer-content">
        <div className="footer-brand">
          <Image
            src="/cremebs.png"
            alt=""
            width={80}
            height={80}
            className="footer-logo"
          />

          <div>
            <strong>{siteConfig.displayName}</strong>
            <span>Games bring us closer</span>
          </div>
        </div>

        <nav
          className="footer-nav"
          aria-label="Footer navigation"
        >
          {siteConfig.navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        {socialLinks.length > 0 && (
          <div className="footer-socials">
            {socialLinks.map(({ label, href, Icon }) => (
              <Link
                key={label}
                href={href}
                {...(href.startsWith("https://")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                aria-label={label}
              >
                <Icon />
              </Link>
            ))}
          </div>
        )}

        <div className="footer-message">
          <span>More than games</span>
          <span>A brighter tomorrow</span>
        </div>
      </div>

      <div className="footer-bottom">
        <span suppressHydrationWarning>
          © {YEAR} BirdShop. All rights reserved.
        </span>

        <span>Payments secured by Stripe · Private digital delivery</span>

        <nav className="footer-legal" aria-label="Policies">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refunds">Refunds</Link>
        </nav>

        {/* "#top" scrolls to the very top; the sticky header is always in view,
            so linking to it would only nudge the page. */}
        <a href="#top">
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </div>
    </footer>
  );
}
