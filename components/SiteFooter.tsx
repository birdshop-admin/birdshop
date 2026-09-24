import Image from "next/image";
import Link from "next/link";

import {
  DiscordIcon,
  InstagramIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/SiteIcons";
import { siteConfig } from "@/lib/site-config";

const socialLinks = [
  {
    label: "Discord",
    href: siteConfig.socials.discord,
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
] as const;

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-overlay" />

      <div className="footer-content">
        <div className="footer-brand">
          <Image
            src="/cremebs.png"
            alt="BirdShop"
            width={180}
            height={180}
            className="footer-logo"
          />

          <div>
            <strong>{siteConfig.displayName}</strong>
            <span>GAMES BRING US CLOSER</span>
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

        <div className="footer-socials">
          {socialLinks.map(({ label, href, Icon }) =>
            href ? (
              <Link
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
              >
                <Icon />
              </Link>
            ) : (
              <span
                key={label}
                className="footer-social-disabled"
                aria-label={`${label} coming soon`}
                title={`${label} coming soon`}
              >
                <Icon />
              </span>
            )
          )}
        </div>

        <div className="footer-message">
          <span>MORE THAN GAMES</span>
          <span>A BRIGHTER TOMORROW</span>
        </div>
      </div>

      <div className="footer-bottom">
        © 2026 Bird Shop. All rights reserved.
      </div>
    </footer>
  );
}
