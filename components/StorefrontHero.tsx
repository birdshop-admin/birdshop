"use client";

import Image from "next/image";
import Link from "next/link";
import CatalogArtwork from "@/components/CatalogArtwork";
import type { HomeService } from "@/app/HomeClient";
import { discordLinkProps, siteConfig } from "@/lib/site-config";
import s from "./StorefrontHero.module.css";

/** Uses only published, available artwork passed through the catalog sanitizer. */
export default function StorefrontHero({ services }: { services: HomeService[] | null }) {
  const featured = services?.find((service) => service.available && service.image);
  return (
    <>
      <section className={s.hero} aria-labelledby="home-hero-title">
        <div className={s.artwork} aria-hidden="true">
          <CatalogArtwork
            src={featured?.image}
            sizes="(max-width: 700px) 100vw, 70vw"
            preload
            fallback={<Image src="/landscape1.webp" alt="" fill sizes="100vw" preload className={s.landscape} />}
          />
        </div>
        <div className={s.shade} />
        <nav className={s.collections} aria-label="Shop collections">
          <span className={s.index}>/ 01</span>
          <span className={s.collectionRule} />
          <Link href="/services" className={s.selected}>Game services <span>↗</span></Link>
          <Link href="/products">Digital products <span>↗</span></Link>
          <Link href="/referrals">Refer &amp; earn <span>↗</span></Link>
        </nav>
        {!featured && <div className={s.brandArtwork} aria-hidden="true">
          <Image src="/cremebs.png" alt="" width={600} height={600} sizes="(max-width: 700px) 240px, 32vw" />
        </div>}
        <div className={s.copy}>
          <p className={s.eyebrow}>BIRDSHOP / THE NEXT LEVEL</p>
          <h1 id="home-hero-title">Your game.<br /><em>Elevated.</em></h1>
          <p className={s.description}>Premium Roblox services and digital essentials, built around your next adventure.</p>
          <Link href="/services" className={s.cta}>Explore services <span aria-hidden="true">↗</span></Link>
          <Link href="/products" className={s.secondary}>Shop digital products <span aria-hidden="true">→</span></Link>
        </div>
        <div className={s.caption}>
          <span>{featured ? featured.game || featured.name : "BIRDSHOP / DIGITAL EXPERIENCES"}</span>
          <Link href={featured ? `/services/${featured.slug}` : "/services"}>
            {featured ? featured.name : "Made for what’s next"} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <span className={s.scroll} aria-hidden="true">SCROLL TO EXPLORE <span>↓</span></span>
      </section>
      <section className={s.information} aria-label="BirdShop information">
        <div className={s.infoHeading}><span className={s.eyebrow}>THE BIRDSHOP EDIT</span><p>Good games.<br />Better together.</p><span className={s.dots} aria-hidden="true"><i /><i /><i /></span></div>
        <Link href="/service-chat" className={s.infoLink}><span className={s.eyebrow}>YOUR ORDERS</span><strong>One private space.<br />Every step of your service.</strong><span className={s.infoAction}>Open My Service <span aria-hidden="true">↗</span></span></Link>
        <Link href="/referrals" className={s.infoLink}><span className={s.eyebrow}>GIVE A LITTLE. GET A LITTLE.</span><strong>Bring your friends.<br />Discover BirdShop rewards.</strong><span className={s.infoAction}>Explore referrals <span aria-hidden="true">↗</span></span></Link>
        <Link href={siteConfig.discordUrl} {...discordLinkProps} className={s.community}><Image src="/landscape2bottom.webp" alt="" fill sizes="(max-width: 700px) 100vw, 260px" /><span>THE COMMUNITY<br /><strong>Find your people.</strong><span>Join us <span aria-hidden="true">↗</span></span></span></Link>
      </section>
    </>
  );
}
