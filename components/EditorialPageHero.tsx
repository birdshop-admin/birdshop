import Image from "next/image";
import Link from "next/link";

type EditorialPageHeroProps = {
  section: "products" | "services" | "referrals" | "reviews" | "cart";
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  /** Only user-supplied or approved photo assets may be displayed. */
  imageSrc?: string;
  imageAlt?: string;
};

/**
 * Shared subpage masthead based on the OWNER-APPROVED Christmas homepage.
 * The hero portrait is intentionally NOT generated or substituted: a blank
 * black image well is preferable to a mismatched face or synthetic person.
 * Reviews has a separate cinematic hero; these mastheads keep the editorial bells.
 */
export default function EditorialPageHero({
  section, eyebrow, title, subtitle, description,
  primary, secondary, imageSrc, imageAlt = "",
}: EditorialPageHeroProps) {
  return (
    <section className={`bs-editorial-hero bs-editorial-hero--${section}`}
      aria-labelledby={`bs-${section}-title`}>
      <div className="bs-editorial-copy">
        <p className="bs-editorial-kicker">{eyebrow}</p>
        <h1 id={`bs-${section}-title`}>{title}</h1>
        <p className="bs-editorial-subtitle">{subtitle}</p>
        <p className="bs-editorial-description">{description}</p>
        {(primary || secondary) && (
          <div className="bs-editorial-actions">
            {primary && <Link href={primary.href} className="bs-editorial-primary">{primary.label}<span aria-hidden="true">↗</span></Link>}
            {secondary && <Link href={secondary.href} className="bs-editorial-secondary">{secondary.label}<span aria-hidden="true">↗</span></Link>}
          </div>
        )}
      </div>
      {imageSrc && (
        <div className="bs-editorial-photowell">
          <Image src={imageSrc} alt={imageAlt} width={1024} height={640}
            className="bs-editorial-photo" unoptimized />
         </div>
      )}
      {section !== "reviews" && <div className="bs-editorial-bells" aria-hidden="true">
        <Image src="/birdshop-christmas-bells-reference.svg" alt=""
          width={168} height={238} className="bs-editorial-bells-image"
          unoptimized />
      </div>}
    </section>
  );
}
