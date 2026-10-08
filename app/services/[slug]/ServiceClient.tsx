"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import CatalogArtwork from "@/components/CatalogArtwork";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import {
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  MessageIcon,
  ShieldIcon,
} from "@/components/SiteIcons";
import { formatUSD } from "@/lib/money";
import {
  HOW_TO_ORDER_CUSTOM,
  HOW_TO_ORDER_PACKAGES,
  buildServicePackages,
  getDefaultServicePackageId,
  isQuoteOnly,
  servicePackageHref,
  type ServicePackageOption,
  type ServicePackageTier,
} from "@/lib/service-packages";
import type { Service } from "@/lib/services";

import styles from "./service.module.css";

/* =========================================================
   HELPERS
========================================================= */

function tierClass(tier: ServicePackageTier | undefined) {
  switch (tier) {
    case "starter":
      return styles.tierStarter;
    case "standard":
      return styles.tierStandard;
    case "premium":
      return styles.tierPremium;
    case "custom":
      return styles.tierCustom;
    default:
      return "";
  }
}

/** Price value per the copy table: "$X" for a package, "By quote" for Custom. */
function priceText(option: ServicePackageOption) {
  return option.price !== null ? formatUSD(option.price) : "By quote";
}

function itemCount(count: number) {
  return count > 0 ? `${count} ${count === 1 ? "item" : "items"}` : "As described";
}

function Seal({ initials }: { initials: string }) {
  return (
    <span className="catalog-artwork-fallback" aria-hidden="true">
      {initials}
    </span>
  );
}

/* =========================================================
   RELATED SERVICE CARD
========================================================= */

function RelatedServiceCard({ service }: { service: Service }) {
  const price =
    isQuoteOnly(service) || service.startingPrice === null
      ? "By quote"
      : `From ${formatUSD(service.startingPrice)}`;

  return (
    <Link href={`/services/${service.slug}`} className={styles.relatedCard}>
      <div
        className={`${styles.relatedVisual} ${service.image ? styles.hasImage : ""}`}
      >
        <CatalogArtwork
          src={service.image}
          sizes="(max-width: 650px) 92vw, (max-width: 900px) 200px, 30vw"
          className={styles.relatedImage}
          fallback={<Seal initials={service.initials} />}
        />

        <span>{service.game}</span>

        <small>{service.category}</small>
      </div>

      <div className={styles.relatedInfo}>
        <span>{service.category}</span>

        <h3>{service.name}</h3>

        <div>
          <strong>{price}</strong>

          <ArrowIcon />
        </div>
      </div>
    </Link>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function ServicePageContent({
  slug,
  serviceList,
}: {
  slug: string;
  serviceList: Service[];
}) {
  const service = serviceList.find((s) => s.slug === slug);

  /* Published tiers + Custom, or only the Custom quote (quote-only). */
  const packages = useMemo(
    () => (service ? buildServicePackages(service) : []),
    [service],
  );

  const [selectedPackage, setSelectedPackage] = useState(() =>
    getDefaultServicePackageId(packages),
  );

  const packageDisplayRef = useRef<HTMLDivElement>(null);

  /* Same game first, then any other BirdShop service, up to three. */
  const relatedServices = useMemo(() => {
    if (!service) return [];

    const result: Service[] = [];

    for (const candidate of serviceList) {
      if (result.length === 3) break;

      if (candidate.slug !== service.slug && candidate.game === service.game) {
        result.push(candidate);
      }
    }

    for (const candidate of serviceList) {
      if (result.length === 3) break;

      if (
        candidate.slug !== service.slug &&
        !result.some((item) => item.slug === candidate.slug)
      ) {
        result.push(candidate);
      }
    }

    return result;
  }, [service, serviceList]);

  /* =======================================================
     SERVICE NOT FOUND
  ======================================================= */

  if (!service) {
    return (
      <main className="page-shell">
        <SiteHeader />

        <section className={styles.notFound}>
          <span>Service not found</span>

          <h1>This service does not exist.</h1>

          <p>Browse the BirdShop service catalog to find another option.</p>

          <Link href="/services">
            Return to Services
            <ArrowIcon />
          </Link>
        </section>

        <SiteFooter />
      </main>
    );
  }

  const currentPackage =
    packages.find((item) => item.id === selectedPackage) ?? packages[0];

  if (!currentPackage) return null;

  /* =======================================================
     SELECTION + ACTIONS

     Fixed packages go to the server-priced Stripe checkout;
     Custom goes to the private service-request flow.
  ======================================================= */

  const quoteOnly = isQuoteOnly(service);
  const tiers = packages.filter((option) => option.tier !== "custom");
  const currentTierClass = tierClass(currentPackage.tier);

  const isCustomPackage = currentPackage.tier === "custom";
  const canContinue =
    service.available && (isCustomPackage || currentPackage.purchasable === true);

  const requestUrl = servicePackageHref(service.slug, currentPackage);
  const priceValue = priceText(currentPackage);
  const actionLabel = isCustomPackage
    ? "Request a Quote"
    : `Buy ${currentPackage.name}`;
  const includeCount = currentPackage.allIncludes.length;

  const badge = service.badge ?? (quoteOnly ? "Custom quote" : undefined);

  const unavailableNote = service.available
    ? "This package is not open for purchases yet."
    : "This service is paused. Check back soon or ask us a question.";

  function selectPackage(id: string) {
    setSelectedPackage(id);

    // Bring the full details into view only when they are off screen
    // (CSS scroll-behavior decides smooth vs instant).
    packageDisplayRef.current?.scrollIntoView({ block: "nearest" });
  }

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* ===================================================
          HERO
      =================================================== */}

      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/">Home</Link>

          <span aria-hidden="true">/</span>

          <Link href="/services">Services</Link>

          <span aria-hidden="true">/</span>

          <span aria-current="page">{service.name}</span>
        </nav>

        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <div className={styles.heroTopline}>
              <span>{service.game}</span>

              <i aria-hidden="true" />

              <span>{service.category}</span>
            </div>

            <h1>{service.name}</h1>

            <p>{service.shortDescription}</p>

            <div className={styles.heroFacts}>
              <span>
                <ClockIcon />
                {service.turnaround}
              </span>

              <span>
                <ShieldIcon />
                {service.delivery}
              </span>

              <span>
                <MessageIcon />
                Private BirdShop chat
              </span>
            </div>
          </div>

          {service.image ? (
            <div className={`${styles.heroVisual} ${styles.heroVisualImage}`}>
              <figure className={styles.heroImageFrame}>
                <CatalogArtwork
                  src={service.image}
                  alt={`${service.name} preview`}
                  sizes="(max-width: 900px) 92vw, (max-width: 1180px) 310px, 390px"
                  preload
                  fallback={<Seal initials={service.initials} />}
                />

                {badge && <span className={styles.heroBadge}>{badge}</span>}

                <figcaption>
                  <span>{service.game}</span>
                  <span>{service.category}</span>
                </figcaption>
              </figure>
            </div>
          ) : (
            <div className={styles.heroVisual} aria-hidden="true">
              {badge && <span className={styles.heroBadge}>{badge}</span>}

              <span className={styles.heroGame}>{service.game}</span>

              <strong>{service.initials}</strong>

              <div className={styles.visualLine} />

              <p>{service.category}</p>

              <small>BirdShop service</small>
            </div>
          )}
        </div>
      </section>

      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <section className={styles.mainSection}>
        <div className={styles.mainLayout}>
          <div className={styles.contentColumn}>
            {/* ABOUT */}

            <section className={styles.aboutSection}>
              <span className={styles.sectionEyebrow}>About this service</span>

              <h2>Built around your request.</h2>

              <p className={styles.description}>{service.description}</p>

              {service.features.length > 0 && (
                <ul className={styles.includedGrid}>
                  {service.features.map((feature, index) => (
                    <li key={`${index}-${feature}`}>
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* PACKAGES / CUSTOM QUOTE */}

            <section
              className={styles.packageSection}
              aria-labelledby="service-options-title"
            >
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>
                    {quoteOnly ? "Custom quote" : "Service options"}
                  </span>

                  <h2 id="service-options-title">
                    {quoteOnly ? "No fixed packages" : "Choose your package."}
                  </h2>
                </div>

                <p>
                  {quoteOnly
                    ? "Tell us what you need. We agree on scope, price and timing with you before you pay."
                    : "Each package shows its price and exactly what is included. Need something else? Ask for a custom quote."}
                </p>
              </div>

              {!quoteOnly && (
                <>
                  <div className={styles.tierOverview} data-count={tiers.length}>
                    {tiers.map((option) => {
                      const selected = option.id === currentPackage.id;

                      return (
                        <article
                          key={option.id}
                          data-tier={option.tier}
                          className={selected ? styles.selectedOverview : undefined}
                        >
                          <span>{option.label}</span>

                          <h3>{option.name}</h3>

                          <strong>{priceText(option)}</strong>

                          <p>{option.subtitle}</p>

                          {option.allIncludes.length > 0 && (
                            <ul>
                              {option.allIncludes.slice(0, 4).map((item, index) => (
                                <li key={`${index}-${item}`}>
                                  <CheckIcon />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className={styles.tierActions}>
                            <button
                              type="button"
                              aria-pressed={selected}
                              aria-controls="service-package-details"
                              aria-label={`View ${option.name} details`}
                              onClick={() => selectPackage(option.id)}
                            >
                              View Details
                            </button>

                            {option.purchasable ? (
                              <Link href={servicePackageHref(service.slug, option)}>
                                Buy {option.name}
                                <ArrowIcon />
                              </Link>
                            ) : (
                              <button type="button" disabled>
                                Currently Unavailable
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <p className={styles.purchaseHint}>
                    Choose a package, pay securely, and your private chat opens
                    after checkout. No ticket needed.{" "}
                    <Link href={HOW_TO_ORDER_PACKAGES}>How package orders work</Link>
                  </p>

                  <div className={styles.customOption}>
                    <div>
                      <strong>Need something different?</strong>

                      <p>
                        Discuss a tailored scope with BirdShop and get a written
                        quote before you pay.{" "}
                        <Link href={HOW_TO_ORDER_CUSTOM}>How custom quotes work</Link>
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-pressed={isCustomPackage}
                      aria-controls="service-package-details"
                      onClick={() => selectPackage("custom")}
                    >
                      Explore a Custom Quote
                      <ArrowIcon />
                    </button>
                  </div>
                </>
              )}

              {/* CURRENT SELECTION IN FULL */}

              <div
                ref={packageDisplayRef}
                key={currentPackage.id}
                id="service-package-details"
                className={`${styles.packageDisplay} ${currentTierClass}`}
              >
                <div className={styles.packageDisplayTop}>
                  <div className={styles.packageTitleArea}>
                    <span className={styles.packageLabel}>
                      {currentPackage.label}
                    </span>

                    <h3>{currentPackage.name}</h3>

                    <p>{currentPackage.subtitle}</p>
                  </div>

                  <div className={styles.packagePrice}>
                    <span>{isCustomPackage ? "Pricing" : "Package price"}</span>

                    <strong>{priceValue}</strong>
                  </div>
                </div>

                <dl className={styles.packageMeta}>
                  {isCustomPackage ? (
                    <>
                      <div>
                        <dt>Request</dt>
                        <dd>Custom quote</dd>
                      </div>

                      <div>
                        <dt>You pay</dt>
                        <dd>After approving the quote</dd>
                      </div>

                      <div>
                        <dt>Scope</dt>
                        <dd>{currentPackage.scope}</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <dt>Package</dt>
                        <dd>{currentPackage.name}</dd>
                      </div>

                      <div>
                        <dt>Included</dt>
                        <dd>{itemCount(includeCount)}</dd>
                      </div>

                      <div>
                        <dt>Delivery</dt>
                        <dd>{service.delivery}</dd>
                      </div>
                    </>
                  )}

                  <div>
                    <dt>Turnaround</dt>
                    <dd>{service.turnaround}</dd>
                  </div>
                </dl>

                {includeCount > 0 && (
                  <div className={styles.fullIncludes}>
                    <div className={styles.includesHeading}>
                      <div>
                        <span>{currentPackage.directLabel}</span>

                        <p>
                          {isCustomPackage
                            ? "No surprises: you approve the price before work begins."
                            : `Everything in the ${currentPackage.name} package.`}
                        </p>
                      </div>

                      {!isCustomPackage && <strong>{itemCount(includeCount)}</strong>}
                    </div>

                    <ul className={styles.directBenefitsGrid}>
                      {currentPackage.allIncludes.map((item, index) => (
                        <li key={`${index}-${item}`}>
                          <span className={styles.checkCircle}>
                            <CheckIcon />
                          </span>

                          <p>{item}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className={styles.packageDisplayBottom}>
                  <div>
                    <span>{isCustomPackage ? "Your request" : "Selected package"}</span>

                    <strong>{currentPackage.name}</strong>
                  </div>

                  <div className={styles.bottomPrice}>
                    <span>Price</span>

                    <strong>{priceValue}</strong>
                  </div>

                  {canContinue ? (
                    <Link href={requestUrl}>
                      {actionLabel}
                      <ArrowIcon />
                    </Link>
                  ) : (
                    <button type="button" className={styles.unavailable} disabled>
                      Currently Unavailable
                    </button>
                  )}
                </div>
              </div>

              <p className={styles.packageNotice}>
                {quoteOnly ? (
                  <>
                    Every request is quoted individually. Work starts after
                    payment is confirmed.{" "}
                    <Link href={HOW_TO_ORDER_CUSTOM}>How custom quotes work</Link>
                  </>
                ) : (
                  "Choose a ready-to-buy package, or discuss a tailored scope with a custom quote."
                )}
              </p>
            </section>

            {/* PROCESS */}

            <section className={styles.processSection}>
              <span className={styles.sectionEyebrow}>How it works</span>

              <h2>Simple from start to finish.</h2>

              <ol className={styles.processGrid}>
                <li>
                  <span>01</span>

                  <h3>{quoteOnly ? "Share your request" : "Choose a package"}</h3>

                  <p>
                    {quoteOnly
                      ? "Describe your goals and send any references."
                      : "Pick a fixed package, or describe a custom request."}
                  </p>
                </li>

                <li>
                  <span>02</span>

                  <h3>{quoteOnly ? "Get your quote" : "Pay securely"}</h3>

                  <p>
                    {quoteOnly
                      ? "We confirm scope, price and turnaround in writing."
                      : "Fixed packages check out right away. Custom requests are reviewed before pricing."}
                  </p>
                </li>

                <li>
                  <span>03</span>

                  <h3>{quoteOnly ? "Approve & pay securely" : "Service begins"}</h3>

                  <p>
                    Work begins after payment is confirmed. Follow progress in
                    your private BirdShop service chat.
                  </p>
                </li>

                <li>
                  <span>04</span>

                  <h3>{quoteOnly ? "Work & completion" : "Completion"}</h3>

                  <p>
                    Review the completed service and confirm everything is
                    finished.
                  </p>
                </li>
              </ol>
            </section>

            {/* REQUIREMENTS */}

            <section className={styles.requirements}>
              <div>
                <span className={styles.sectionEyebrow}>Before we begin</span>

                <h2>What we may need from you.</h2>

                <p>
                  Exact requirements depend on the service. BirdShop confirms
                  everything necessary before work begins.
                </p>
              </div>

              <ol className={styles.requirementList}>
                <li>
                  <span>01</span>
                  <p>Your game, platform, or service details.</p>
                </li>

                <li>
                  <span>02</span>
                  <p>Goals, references, examples, or specific requirements.</p>
                </li>

                <li>
                  <span>03</span>
                  <p>Preferred turnaround or scheduling information.</p>
                </li>

                <li>
                  <span>04</span>
                  <p>Any additional information needed for the selected service.</p>
                </li>
              </ol>
            </section>

            {/* FAQ */}

            <section className={styles.faqSection}>
              <span className={styles.sectionEyebrow}>Service FAQ</span>

              <h2>Common questions.</h2>

              <div className={styles.faqList}>
                <details>
                  <summary>
                    When does the service begin?
                    <span aria-hidden="true">+</span>
                  </summary>

                  <p>
                    Timing is confirmed after BirdShop reviews your request and
                    verifies the required information.
                  </p>
                </details>

                <details>
                  <summary>
                    {quoteOnly ? "How is the price decided?" : "Is the listed price final?"}
                    <span aria-hidden="true">+</span>
                  </summary>

                  <p>
                    {quoteOnly
                      ? "Your price is confirmed after BirdShop reviews your requirements. You approve the quote before paying."
                      : "Fixed packages show the price for their listed scope before checkout. Custom requests are quoted after BirdShop reviews your requirements."}
                  </p>
                </details>

                <details>
                  <summary>
                    Can I request something different?
                    <span aria-hidden="true">+</span>
                  </summary>

                  <p>
                    Yes. Describe your requirements and share references.
                    BirdShop can review your request with you in the private
                    service chat.
                  </p>
                </details>

                <details>
                  <summary>
                    How will I receive updates?
                    <span aria-hidden="true">+</span>
                  </summary>

                  <p>
                    Communication, payment requests, and progress updates are
                    handled through your private BirdShop service chat.
                  </p>
                </details>
              </div>
            </section>
          </div>

          {/* STICKY SUMMARY */}

          <aside
            className={`${styles.requestCard} ${currentTierClass}`}
            aria-label="Your selection"
          >
            <div className={styles.requestTierLine} />

            <span>Your service</span>

            <h2>{service.name}</h2>

            <div className={styles.requestSelected}>
              <span>{quoteOnly ? "Pricing" : "Selected package"}</span>

              <div>
                <strong>{currentPackage.name}</strong>

                <strong className={styles.requestSelectedPrice}>{priceValue}</strong>
              </div>
            </div>

            <dl className={styles.requestFacts}>
              <div>
                <dt>Game</dt>
                <dd>{service.game}</dd>
              </div>

              <div>
                <dt>{isCustomPackage ? "Payment" : "Included"}</dt>
                <dd>{isCustomPackage ? "After quote approval" : itemCount(includeCount)}</dd>
              </div>

              <div>
                <dt>Turnaround</dt>
                <dd>{service.turnaround}</dd>
              </div>

              <div>
                <dt>Delivery</dt>
                <dd>{service.delivery}</dd>
              </div>
            </dl>

            {canContinue ? (
              <Link href={requestUrl} className={styles.requestButton}>
                {isCustomPackage ? <MessageIcon /> : <ShieldIcon />}
                {actionLabel}
                <ArrowIcon />
              </Link>
            ) : (
              <button type="button" className={styles.unavailable} disabled>
                Currently Unavailable
              </button>
            )}

            <p className={styles.requestNote}>
              {!canContinue
                ? unavailableNote
                : isCustomPackage
                  ? "Scope and price are confirmed before work begins."
                  : "Pay securely, then continue directly into your private BirdShop chat."}
            </p>

            <div className={styles.requestLinks}>
              <Link href="/contact">Have a question first?</Link>

              <Link href={isCustomPackage ? HOW_TO_ORDER_CUSTOM : HOW_TO_ORDER_PACKAGES}>
                {isCustomPackage ? "How custom quotes work" : "How package orders work"}
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* MOBILE STICKY CTA (forest, ≤900px only). The shell gets a bottom
          margin in CSS so the bar never covers the footer. */}

      <div className={styles.mobileCta}>
        <div>
          <span>
            {isCustomPackage ? "Custom quote" : `${currentPackage.name} package`}
          </span>

          <strong>{priceValue}</strong>
        </div>

        {canContinue ? (
          <Link href={requestUrl}>
            {actionLabel}
            <ArrowIcon />
          </Link>
        ) : (
          <button type="button" disabled>
            Unavailable
          </button>
        )}
      </div>

      {/* SUPPORT STRIP */}

      <section className={styles.supportStrip} aria-label="BirdShop support">
        <div>
          <MessageIcon />

          <span>
            <strong>Clear communication</strong>
            Discuss details before starting.
          </span>
        </div>

        <div>
          <ClockIcon />

          <span>
            <strong>Realistic turnaround</strong>
            Timing is confirmed first.
          </span>
        </div>

        <div>
          <ShieldIcon />

          <span>
            <strong>BirdShop support</strong>
            Help available when needed.
          </span>
        </div>
      </section>

      {/* RELATED */}

      {relatedServices.length > 0 && (
        <section className={styles.relatedSection}>
          <div className={styles.relatedHeading}>
            <div>
              <span className={styles.sectionEyebrow}>Keep browsing</span>

              <h2>Related services</h2>
            </div>

            <Link href="/services">
              View All Services
              <ArrowIcon />
            </Link>
          </div>

          <div className={styles.relatedGrid}>
            {relatedServices.map((relatedService) => (
              <RelatedServiceCard
                key={relatedService.slug}
                service={relatedService}
              />
            ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
