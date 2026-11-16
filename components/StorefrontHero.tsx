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
        <nav className={s.heroSteps} aria-label="Homepage sections">
          <span aria-current="true">01</span><span>02</span><span>03</span>
        </nav>
        <div className={s.copy}>
          <p className={s.eyebrow}>THIS CHRISTMAS AT</p>
          <h1 id="home-hero-title">BIRD SHOP</h1>
          <p className={s.issue}>PREMIUM SERVICES <span aria-hidden="true">&amp;</span> DIGITAL GOODS</p>
          <p className={s.description}>Trusted game services, digital products and more — all season long.</p>
          <div className={s.actions}>
            <Link href="/products" className={s.primary}>SHOP NOW <span aria-hidden="true">↗</span></Link>
            <Link href="/services" className={s.secondary}>OUR SERVICES <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <div className={s.christmasBells} aria-hidden="true">
          <div className={s.bellString}>
            <Image
              src="/birdshop-christmas-bells-reference.svg"
              alt=""
              width={168}
              height={238}
              priority
              unoptimized
              className={s.bellReference}
            />
          </div>
        </div>
        <div className={s.artwork} aria-hidden="true">
          <Image src="/birdshop-approved-christmas-portrait.svg" alt="" width={510} height={537} priority className={s.portrait} />
        </div>
        <div className={s.bottomLine}>
          <span>BIRDSHOP.STORE</span>
          <span>EST. {siteConfig.established}</span>
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
