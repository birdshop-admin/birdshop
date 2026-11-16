import Link from "next/link";
import Image from "next/image";
import type { HomeService } from "@/app/HomeClient";
import { discordLinkProps, siteConfig } from "@/lib/site-config";
import s from "./StorefrontHero.module.css";

/**
 * Raven ink asset supplied by the BirdShop owner. No generated imagery.
 */
export default function StorefrontHero({ services }: { services: HomeService[] | null }) {
  const featured = services?.find((service) => service.available);
  return (
    <>
      <section className={s.hero} aria-labelledby="home-hero-title">
        <div className={s.copy}>
          <p className={s.eyebrow}><span className={s.rule} /> BIRD SHOP — DIGITAL GOODS &amp; GAME SERVICES</p>
          <span className={s.issue}>INDEPENDENT / PLAYER-FOCUSED / EST. 2024</span>
          <h1 id="home-hero-title">Less waiting.<br /><em>More playing.</em></h1>
          <p className={s.description}>Digital products and game services, without the runaround. Browse what&apos;s available or open a private conversation about what you need.</p>
          <div className={s.actions}>
            <Link href="/products" className={s.primary}>Browse products <span aria-hidden="true">↗</span></Link>
            <Link href="/services" className={s.secondary}>Explore services <span aria-hidden="true">↗</span></Link>
          </div>
          <div className={s.utility}>
            <Link href="/how-to-order">How ordering works <span aria-hidden="true">↗</span></Link>
            <span aria-hidden="true" className={s.utilityDivider} />
            <Link href="/service-chat">My service chat <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <div className={s.artwork} aria-label="Raven ink artwork">
          <div className={s.paper}>
            <span className={s.artIndex}>FIG. 01 / THE RAVEN</span>
            <div className={s.inkDust} aria-hidden="true" />
            <Image src="/birdshop-raven-ink.svg" alt="Original raven ink illustration supplied by BirdShop" width={615} height={800} className={s.raven} priority />
            <span className={s.artCaption}>BIRD SHOP <span>—</span> INK STUDIES</span>
          </div>
        </div>
        <div className={s.bottomLine}>
          <span>01 / INDEPENDENT GAME STORE</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>
      <section className={s.information} aria-label="BirdShop shortcuts">
        <Link href={featured ? `/services/${featured.slug}` : "/services"} className={s.infoBlock}>
          <span className={s.infoIndex}>01 / SERVICES</span>
          <strong>{featured?.name ?? "Find a service"}</strong>
          <span className={s.infoAction}>Explore <span aria-hidden="true">↗</span></span>
        </Link>
        <Link href="/products" className={s.infoBlock}>
          <span className={s.infoIndex}>02 / CATALOG</span>
          <strong>Browse digital products</strong>
          <span className={s.infoAction}>Shop <span aria-hidden="true">↗</span></span>
        </Link>
        <Link href="/referrals" className={s.infoBlock}>
          <span className={s.infoIndex}>03 / REFER &amp; EARN</span>
          <strong>$0.50 per qualifying new customer.</strong>
          <span className={s.infoAction}>Get your link <span aria-hidden="true">↗</span></span>
        </Link>
        <Link href={siteConfig.discordUrl} {...discordLinkProps} className={s.infoBlock}>
          <span className={s.infoIndex}>04 / COMMUNITY</span>
          <strong>Find us on Discord</strong>
          <span className={s.infoAction}>Join the conversation <span aria-hidden="true">↗</span></span>
        </Link>
      </section>
    </>
  );
}
