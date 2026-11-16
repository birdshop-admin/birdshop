import Link from "next/link";
import type { HomeService } from "@/app/HomeClient";
import { discordLinkProps, siteConfig } from "@/lib/site-config";
import s from "./StorefrontHero.module.css";

/**
 * Editorial raven silhouette traced from the BirdShop owner's supplied
 * monochrome ink artwork. No generated imagery or third-party image assets.
 */
function RavenIllustration() {
  return (
    <svg className={s.raven} viewBox="0 0 300 390" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M108,40 71,83 73,95 64,105 78,106 72,141 81,139 82,118 91,123 97,147 89,152 86,167 93,183 121,197 131,191 134,205 128,215 111,220 106,215 104,225 97,194 77,183 94,223 90,228 96,218 125,236 106,239 88,234 88,229 73,232 108,248 116,263 112,275 122,278 151,338 89,328 102,338 81,341 81,348 191,353 195,332 223,354 240,352 229,335 227,317 244,303 254,316 292,310 288,306 297,303 281,297 293,291 285,275 295,254 287,257 282,250 272,262 263,262 270,250 245,221 259,230 254,218 267,215 217,144 218,130 178,87 177,77 145,72 147,65 176,53 135,38Z" fill="currentColor" />
      <path d="M85 151 Q115 173 150 191 M106 196 Q140 210 197 245 M123 235 Q150 252 217 301 M92 126 Q122 146 175 166 M94 179 Q111 214 150 239" stroke="#eeeae4" strokeWidth="2.5" strokeOpacity=".5" fill="none" />
      <path d="M78 97 Q113 76 143 80" stroke="#eeeae4" strokeWidth="2.5" strokeOpacity=".75" fill="none" />
    </svg>
  );
}

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
            <RavenIllustration />
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
