"use client";

import Link from "next/link";

import { use, useMemo, useState } from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import {
  CheckIcon,
  ClockIcon,
  ShieldIcon,
  MessageIcon,
  ArrowIcon,
} from "@/components/SiteIcons";

import { serviceList, services, type Service } from "@/lib/services";

import {
  buildServicePackages,
  getDefaultServicePackageId,
  type ServicePackageTier,
} from "@/lib/service-packages";

import styles from "./service.module.css";

/* =========================================================
   TIER STYLE HELPER
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

/* =========================================================
   RELATED SERVICE CARD
========================================================= */

function RelatedServiceCard({ service }: { service: Service }) {
  return (
    <Link href={`/services/${service.slug}`} className={styles.relatedCard}>
      <div className={styles.relatedVisual}>
        <span>{service.game}</span>

        <strong>{service.initials}</strong>

        <small>{service.category}</small>
      </div>

      <div className={styles.relatedInfo}>
        <span>{service.category}</span>

        <h3>{service.name}</h3>

        <div>
          <strong>
            {service.startingPrice !== null
              ? `From $${service.startingPrice.toFixed(2)}`
              : "Custom Quote"}
          </strong>

          <ArrowIcon />
        </div>
      </div>
    </Link>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function ServicePage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = use(params);

  return <ServicePageContent key={slug} slug={slug} />;
}

function ServicePageContent({ slug }: { slug: string }) {
  const service = services[slug];

  /* =======================================================
     PACKAGES
  ======================================================= */

  const packages = useMemo(
    () => (service ? buildServicePackages(service) : []),
    [service],
  );

  /*
    This explicitly chooses Starter whenever possible.

    It does NOT use "recommended".
  */

  const defaultPackageId = getDefaultServicePackageId(packages);

  const [selectedPackage, setSelectedPackage] = useState(defaultPackageId);

  const [inheritanceOpen, setInheritanceOpen] = useState(false);

  const currentPackage =
    packages.find((item) => item.id === selectedPackage) ?? packages[0];

  const currentTierClass = tierClass(currentPackage?.tier);

  /* =======================================================
     RELATED SERVICES
  ======================================================= */

  const relatedServices = useMemo(() => {
    if (!service) {
      return [];
    }

    const result: Service[] = [];

    /*
        First prioritize services
        from the same game.
      */

    for (const candidate of serviceList) {
      if (candidate.slug !== service.slug && candidate.game === service.game) {
        result.push(candidate);
      }

      if (result.length === 3) {
        break;
      }
    }

    /*
        Fill any empty slots with
        other BirdShop services.
      */

    if (result.length < 3) {
      for (const candidate of serviceList) {
        const alreadyAdded = result.some(
          (item) => item.slug === candidate.slug,
        );

        if (candidate.slug !== service.slug && !alreadyAdded) {
          result.push(candidate);
        }

        if (result.length === 3) {
          break;
        }
      }
    }

    return result;
  }, [service]);

  /* =======================================================
     SERVICE NOT FOUND
  ======================================================= */

  if (!service) {
    return (
      <main className="page-shell">
        <SiteHeader />

        <section className={styles.notFound}>
          <span>SERVICE NOT FOUND</span>

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

  if (!currentPackage) {
    return null;
  }

  /* =======================================================
     SERVICE ACTION

     Fixed-price tiers and Custom now carry their intent
     separately into the next step.

     We are deliberately NOT pretending checkout is live yet.
     The next backend pass will connect fixed tiers directly
     to Stripe and Custom to the native service-request flow.
  ======================================================= */

  const isCustomPackage = currentPackage.tier === "custom";

  const requestUrl = `/contact?topic=service&service=${encodeURIComponent(
    service.slug,
  )}&package=${encodeURIComponent(currentPackage.id)}&mode=${
    isCustomPackage ? "custom" : "package"
  }`;

  const primaryActionLabel = isCustomPackage
    ? "Build Custom Request"
    : `Continue With ${currentPackage.name}`;

  const stickyActionLabel = isCustomPackage
    ? "Start Custom Request"
    : `Continue With ${currentPackage.name}`;

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* ===================================================
          HERO
      =================================================== */}

      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <div className={styles.breadcrumbs}>
          <Link href="/">Home</Link>

          <span>/</span>

          <Link href="/services">Services</Link>

          <span>/</span>

          <span>{service.name}</span>
        </div>

        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <div className={styles.heroTopline}>
              <span>{service.game}</span>

              <i />

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
                Private BirdShop Chat
              </span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.visualGlow} />

            {service.badge && (
              <span className={styles.heroBadge}>{service.badge}</span>
            )}

            <span className={styles.heroGame}>{service.game}</span>

            <strong>{service.initials}</strong>

            <div className={styles.visualLine} />

            <p>{service.category}</p>

            <small>BIRDSHOP SERVICE</small>
          </div>
        </div>
      </section>

      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <section className={styles.mainSection}>
        <div className={styles.mainLayout}>
          <div className={styles.contentColumn}>
            {/* =================================================
                ABOUT
            ================================================= */}

            <section className={styles.aboutSection}>
              <span className={styles.sectionEyebrow}>ABOUT THIS SERVICE</span>

              <h2>Built around your request.</h2>

              <p className={styles.description}>{service.description}</p>

              <div className={styles.includedGrid}>
                {service.features.map((feature) => (
                  <div key={feature}>
                    <CheckIcon />

                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* =================================================
                PACKAGE CONFIGURATOR
            ================================================= */}

            <section className={styles.packageSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>SERVICE OPTIONS</span>

                  <h2>Choose your package.</h2>
                </div>

                <p>
                  Start with the base package, then compare exactly what each
                  upgraded tier adds.
                </p>
              </div>

              <div className={styles.packageExperience}>
                {/* ===========================================
                    LARGE CURRENT PACKAGE
                =========================================== */}

                <div
                  key={currentPackage.id}
                  className={`${styles.packageDisplay} ${currentTierClass}`}
                >
                  {/* TOP */}

                  <div className={styles.packageDisplayTop}>
                    <div className={styles.packageTitleArea}>
                      <span className={styles.packageLabel}>
                        {currentPackage.label}
                      </span>

                      <h3>{currentPackage.name}</h3>

                      <p>{currentPackage.subtitle}</p>
                    </div>

                    <div className={styles.packagePrice}>
                      <span>PACKAGE PRICE</span>

                      <strong>
                        {currentPackage.price !== null
                          ? `$${currentPackage.price.toFixed(2)}`
                          : "CUSTOM QUOTE"}
                      </strong>
                    </div>
                  </div>

                  {/* =========================================
                      PACKAGE META
                  ========================================= */}

                  <div className={styles.packageMeta}>
                    <div>
                      <span>PACKAGE</span>

                      <strong>{currentPackage.name}</strong>
                    </div>

                    <div>
                      <span>TOTAL BENEFITS</span>

                      <strong>
                        {currentPackage.allIncludes.length} Included
                      </strong>
                    </div>

                    <div>
                      <span>SCOPE</span>

                      <strong>{currentPackage.scope}</strong>
                    </div>

                    <div>
                      <span>TURNAROUND</span>

                      <strong>{service.turnaround}</strong>
                    </div>
                  </div>

                  {/* =========================================
                      EVERYTHING INCLUDED
                  ========================================= */}

                  <div className={styles.fullIncludes}>
                    <div className={styles.includesHeading}>
                      <div>
                        <span>EVERYTHING INCLUDED</span>

                        <p>See exactly what this package includes.</p>
                      </div>

                      <strong>{currentPackage.allIncludes.length} TOTAL</strong>
                    </div>

                    {/* =======================================
                        INHERITED TIER
                    ======================================= */}

                    {currentPackage.inheritedGroups &&
                      currentPackage.inheritedGroups.length > 0 && (
                        <div className={styles.inheritanceArea}>
                          <button
                            type="button"
                            className={styles.inheritanceCard}
                            aria-expanded={inheritanceOpen}
                            onClick={() =>
                              setInheritanceOpen((current) => !current)
                            }
                          >
                            <span className={styles.inheritanceCheck}>
                              <CheckIcon />
                            </span>

                            <div className={styles.inheritanceCopy}>
                              <span>ALREADY INCLUDED</span>

                              <strong>{currentPackage.inheritsLabel}</strong>

                              <p>{currentPackage.inheritanceSummary}</p>
                            </div>

                            <div className={styles.inheritanceAction}>
                              <span>
                                {inheritanceOpen
                                  ? "Hide Included"
                                  : "View Everything"}
                              </span>

                              <strong>{inheritanceOpen ? "−" : "+"}</strong>
                            </div>
                          </button>

                          {/* EXPANDED */}

                          {inheritanceOpen && (
                            <div className={styles.inheritedExpanded}>
                              {currentPackage.inheritedGroups.map((group) => (
                                <div
                                  key={group.name}
                                  className={`${styles.inheritedGroup} ${tierClass(
                                    group.tier,
                                  )}`}
                                >
                                  <div className={styles.inheritedGroupHeading}>
                                    <div>
                                      <span
                                        className={styles.inheritedTierDot}
                                      />

                                      <strong>{group.name}</strong>
                                    </div>

                                    <small>{group.items.length} included</small>
                                  </div>

                                  <div className={styles.inheritedItemGrid}>
                                    {group.items.map((item) => (
                                      <div key={`${group.name}-${item}`}>
                                        <CheckIcon />

                                        <span>{item}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    {/* =======================================
                        CURRENT TIER BENEFITS
                    ======================================= */}

                    <div className={styles.directBenefits}>
                      <div className={styles.directBenefitsHeading}>
                        <div>
                          <span className={styles.tierMiniBar} />

                          <strong>{currentPackage.directLabel}</strong>
                        </div>

                        <small>
                          {currentPackage.directIncludes.length}{" "}
                          {currentPackage.directIncludes.length === 1
                            ? "benefit"
                            : "benefits"}
                        </small>
                      </div>

                      <div className={styles.directBenefitsGrid}>
                        {currentPackage.directIncludes.map((item) => (
                          <div key={item}>
                            <span className={styles.checkCircle}>
                              <CheckIcon />
                            </span>

                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* =========================================
                      BOTTOM CTA
                  ========================================= */}

                  <div className={styles.packageDisplayBottom}>
                    <div>
                      <span>CURRENT SELECTION</span>

                      <strong>{currentPackage.name}</strong>
                    </div>

                    <div className={styles.bottomPrice}>
                      <span>PRICE</span>

                      <strong>
                        {currentPackage.price !== null
                          ? `$${currentPackage.price.toFixed(2)}`
                          : "Custom Quote"}
                      </strong>
                    </div>

                    <Link href={requestUrl}>
                      {primaryActionLabel}

                      <ArrowIcon />
                    </Link>
                  </div>
                </div>

                {/* ===========================================
                    SMALL PACKAGE SELECTORS

                    Order:
                    Custom scope, reviewed with you
                =========================================== */}

                {packages.length > 1 && (
                  <div className={styles.packageSelectors}>
                    {packages.map((option) => {
                      const active = option.id === currentPackage.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setSelectedPackage(option.id);
                            setInheritanceOpen(false);
                          }}
                          className={`${styles.packageSelector} ${tierClass(
                            option.tier,
                          )} ${active ? styles.activeSelector : ""}`}
                        >
                          <div className={styles.selectorAccent} />

                          <div className={styles.selectorTop}>
                            <div>
                              <span>{option.label}</span>

                              <strong>{option.name}</strong>
                            </div>

                            {option.recommended && (
                              <span className={styles.selectorRecommended}>
                                POPULAR
                              </span>
                            )}
                          </div>

                          <p>{option.subtitle}</p>

                          <div className={styles.selectorStats}>
                            <span>{option.allIncludes.length} total</span>

                            {option.inheritedGroups && (
                              <span>Includes previous tier</span>
                            )}
                          </div>

                          <div className={styles.selectorBottom}>
                            <strong>
                              {option.price !== null
                                ? `$${option.price.toFixed(2)}`
                                : "Custom Quote"}
                            </strong>

                            <span>
                              {active ? "Viewing" : "View Package"}

                              {active ? <CheckIcon /> : <ArrowIcon />}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className={styles.packageNotice}>
                Every request is Custom. Discuss your requirements in private chat before agreeing to a quote.
              </p>
            </section>

            {/* =================================================
                PROCESS
            ================================================= */}

            <section className={styles.processSection}>
              <span className={styles.sectionEyebrow}>HOW IT WORKS</span>

              <h2>Simple from start to finish.</h2>

              <div className={styles.processGrid}>
                <div>
                  <span>01</span>

                  <h3>Choose Your Plan</h3>

                  <p>
                    Describe the custom scope you need.
                  </p>
                </div>

                <div>
                  <span>02</span>

                  <h3>Confirm the Details</h3>

                  <p>
                    Custom requests are reviewed before pricing is agreed.
                  </p>
                </div>

                <div>
                  <span>03</span>

                  <h3>Service Begins</h3>

                  <p>
                    After payment or quote approval, your private BirdShop
                    service chat stays available.
                  </p>
                </div>

                <div>
                  <span>04</span>

                  <h3>Completion</h3>

                  <p>
                    Review the completed service and confirm everything is
                    finished.
                  </p>
                </div>
              </div>
            </section>

            {/* =================================================
                REQUIREMENTS
            ================================================= */}

            <section className={styles.requirements}>
              <div>
                <span className={styles.sectionEyebrow}>BEFORE WE BEGIN</span>

                <h2>What we may need from you.</h2>

                <p>
                  Exact requirements depend on the service. BirdShop confirms
                  everything necessary before work begins.
                </p>
              </div>

              <div className={styles.requirementList}>
                <div>
                  <span>01</span>

                  <p>Your game, platform, or service details.</p>
                </div>

                <div>
                  <span>02</span>

                  <p>Goals, references, examples, or specific requirements.</p>
                </div>

                <div>
                  <span>03</span>

                  <p>Preferred turnaround or scheduling information.</p>
                </div>

                <div>
                  <span>04</span>

                  <p>
                    Any additional information needed for the selected service.
                  </p>
                </div>
              </div>
            </section>

            {/* =================================================
                FAQ
            ================================================= */}

            <section className={styles.faqSection}>
              <span className={styles.sectionEyebrow}>SERVICE FAQ</span>

              <h2>Common questions.</h2>

              <div className={styles.faqList}>
                <details>
                  <summary>
                    When does the service begin?
                    <span>+</span>
                  </summary>

                  <p>
                    Timing is confirmed after BirdShop reviews your request and
                    verifies the required information.
                  </p>
                </details>

                <details>
                  <summary>
                    Is the listed price final?
                    <span>+</span>
                  </summary>

                  <p>
                    Custom requests are quoted after BirdShop reviews the requested scope.
                  </p>
                </details>

                <details>
                  <summary>
                    Can I request something different?
                    <span>+</span>
                  </summary>

                  <p>
                    Yes. Choose Custom to modify a normal package or describe a
                    completely custom service. BirdShop can review it with you
                    in the private service chat.
                  </p>
                </details>

                <details>
                  <summary>
                    How will I receive updates?
                    <span>+</span>
                  </summary>

                  <p>
                    Communication, payment requests, and progress updates are
                    handled through your private BirdShop service chat.
                  </p>
                </details>
              </div>
            </section>
          </div>

          {/* =================================================
              STICKY REQUEST SUMMARY
          ================================================= */}

          <aside className={`${styles.requestCard} ${currentTierClass}`}>
            <div className={styles.requestTierLine} />

            <span>YOUR SERVICE</span>

            <h2>{service.name}</h2>

            <div className={styles.requestSelected}>
              <span>SELECTED PACKAGE</span>

              <div>
                <strong>{currentPackage.name}</strong>

                <strong className={styles.requestSelectedPrice}>
                  {currentPackage.price !== null
                    ? `$${currentPackage.price.toFixed(2)}`
                    : "Custom Quote"}
                </strong>
              </div>
            </div>

            <div className={styles.requestFacts}>
              <div>
                <span>GAME</span>

                <strong>{service.game}</strong>
              </div>

              <div>
                <span>PACKAGE BENEFITS</span>

                <strong>{currentPackage.allIncludes.length} included</strong>
              </div>

              <div>
                <span>TURNAROUND</span>

                <strong>{service.turnaround}</strong>
              </div>

              <div>
                <span>DELIVERY</span>

                <strong>{service.delivery}</strong>
              </div>
            </div>

            <Link href={requestUrl} className={styles.requestButton}>
              <MessageIcon />

              {stickyActionLabel}

              <ArrowIcon />
            </Link>

            <p className={styles.requestNote}>
              {isCustomPackage
                ? "Custom scope and pricing are confirmed before work begins."
                : "This package keeps the listed scope and price before checkout is connected."}
            </p>

            <Link href="/contact" className={styles.questionLink}>
              Have a question first?
            </Link>
          </aside>
        </div>
      </section>

      {/* ===================================================
          SUPPORT STRIP
      =================================================== */}

      <section className={styles.supportStrip}>
        <div>
          <MessageIcon />

          <span>
            <strong>Clear Communication</strong>
            Discuss details before starting.
          </span>
        </div>

        <div>
          <ClockIcon />

          <span>
            <strong>Realistic Turnaround</strong>
            Timing is confirmed first.
          </span>
        </div>

        <div>
          <ShieldIcon />

          <span>
            <strong>BirdShop Support</strong>
            Help available when needed.
          </span>
        </div>
      </section>

      {/* ===================================================
          RELATED SERVICES
      =================================================== */}

      <section className={styles.relatedSection}>
        <div className={styles.relatedHeading}>
          <div>
            <span className={styles.sectionEyebrow}>KEEP BROWSING</span>

            <h2>Related Services</h2>
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

      <SiteFooter />
    </main>
  );
}
