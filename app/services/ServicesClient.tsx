"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import CatalogArtwork from "@/components/CatalogArtwork";
import ServiceCardPlanControls from "@/components/ServiceCardPlanControls";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import {
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  MessageIcon,
  PeopleIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/SiteIcons";
import { formatUSD } from "@/lib/money";
import { HOW_TO_ORDER_CUSTOM, isQuoteOnly } from "@/lib/service-packages";
import type { Service } from "@/lib/services";

import styles from "./services.module.css";

const INITIAL_VISIBLE = 8;
const LOAD_MORE_AMOUNT = 8;

const ALL_GAMES = "All Services";
const ALL_TYPES = "All Types";

/** General custom request (no specific listing). */
const CUSTOM_REQUEST_URL = "/contact?topic=service";

function priceLabel(service: Service) {
  return isQuoteOnly(service) || service.startingPrice === null
    ? "By quote"
    : `From ${formatUSD(service.startingPrice)}`;
}

function Seal({ initials }: { initials: string }) {
  return (
    <span className="catalog-artwork-fallback" aria-hidden="true">
      {initials}
    </span>
  );
}

/* =========================================================
   FEATURED CARD
========================================================= */

function FeaturedServiceCard({ service }: { service: Service }) {
  const quoteOnly = isQuoteOnly(service);
  const href = `/services/${service.slug}`;

  return (
    <article className={styles.featuredCard}>
      {/* Mouse convenience only: the visible link below is the keyboard target. */}
      <Link
        href={href}
        className={styles.cardOverlay}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div
        className={`${styles.featuredVisual} ${service.image ? styles.hasImage : ""}`}
      >
        <CatalogArtwork
          src={service.image}
          sizes="(max-width: 650px) 92vw, (max-width: 1250px) 260px, 220px"
          className={styles.visualImage}
          fallback={<Seal initials={service.initials} />}
        />

        <span className={styles.featuredBadge}>
          {service.badge ?? (quoteOnly ? "Custom quote" : "Featured")}
        </span>

        <small>{service.game}</small>
      </div>

      <div className={styles.featuredInfo}>
        <span className={styles.featuredCategory}>{service.category}</span>

        <h3>{service.name}</h3>

        <p>{service.shortDescription}</p>

        <div className={styles.featuredBottom}>
          <strong>{priceLabel(service)}</strong>

          <Link href={href}>
            {quoteOnly ? "View Service" : "View Packages"}
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* =========================================================
   SERVICE CARD
========================================================= */

function ServiceCard({ service }: { service: Service }) {
  const quoteOnly = isQuoteOnly(service);
  const badge = service.badge ?? (quoteOnly ? "Custom quote" : undefined);

  return (
    <article className={styles.serviceCard}>
      {/* The whole card opens the detail page; the controls carry the
          keyboard-reachable links. */}
      <Link
        href={`/services/${service.slug}`}
        className={styles.cardOverlay}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div
        className={`${styles.serviceVisual} ${service.image ? styles.hasImage : ""}`}
      >
        <CatalogArtwork
          src={service.image}
          sizes="(max-width: 700px) 92vw, (max-width: 1250px) 44vw, 520px"
          className={styles.visualImage}
          fallback={<Seal initials={service.initials} />}
        />

        {badge && <span className={styles.serviceBadge}>{badge}</span>}

        <span className={styles.visualGame}>{service.game}</span>

        <span className={styles.visualType}>{service.category}</span>
      </div>

      <div className={styles.serviceBody}>
        <div className={styles.serviceCopy}>
          <div className={styles.serviceMeta}>
            <span>{service.game}</span>

            <span
              className={service.available ? styles.available : styles.paused}
            >
              {service.available ? <CheckIcon /> : <ClockIcon />}
              {service.available ? "Available" : "Paused"}
            </span>
          </div>

          <h3>{service.name}</h3>

          <p className={styles.serviceDescription}>
            {service.shortDescription}
          </p>

          {service.features.length > 0 && (
            <ul className={styles.features}>
              {service.features.slice(0, 3).map((feature) => (
                <li key={feature}>
                  <CheckIcon />
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pushed to the bottom so CTAs line up across a grid row. */}
        <ServiceCardPlanControls service={service} />
      </div>
    </article>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function ServicesPage({
  serviceList,
}: {
  serviceList: Service[];
}) {
  const [search, setSearch] = useState("");
  const [game, setGame] = useState(ALL_GAMES);
  const [category, setCategory] = useState(ALL_TYPES);
  const [sort, setSort] = useState("featured");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Typing stays smooth: the grid filters on a deferred copy of the query.
  const deferredSearch = useDeferredValue(search);

  const { gameFilters, categoryFilters } = useMemo(() => {
    const games = new Map<string, number>();
    const categories = new Map<string, number>();

    for (const service of serviceList) {
      games.set(service.game, (games.get(service.game) ?? 0) + 1);
      categories.set(
        service.category,
        (categories.get(service.category) ?? 0) + 1,
      );
    }

    return {
      gameFilters: [
        [ALL_GAMES, serviceList.length] as const,
        ...games.entries(),
      ],
      categoryFilters: [
        [ALL_TYPES, serviceList.length] as const,
        ...categories.entries(),
      ],
    };
  }, [serviceList]);

  const featuredServices = useMemo(
    () => serviceList.filter((service) => service.featured).slice(0, 3),
    [serviceList],
  );

  const filteredServices = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    let result = serviceList.filter((service) => {
      const matchesSearch =
        query.length === 0 ||
        service.name.toLowerCase().includes(query) ||
        service.game.toLowerCase().includes(query) ||
        service.category.toLowerCase().includes(query);

      const matchesGame = game === ALL_GAMES || service.game === game;

      const matchesCategory =
        category === ALL_TYPES || service.category === category;

      return matchesSearch && matchesGame && matchesCategory;
    });

    // Quote-only services have no starting price and always sort last.
    if (sort === "price-low" || sort === "price-high") {
      const direction = sort === "price-low" ? 1 : -1;

      result = [...result].sort((a, b) => {
        if (a.startingPrice === null) return b.startingPrice === null ? 0 : 1;
        if (b.startingPrice === null) return -1;

        return (a.startingPrice - b.startingPrice) * direction;
      });
    }

    if (sort === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sort === "featured") {
      result = [...result].sort(
        (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)),
      );
    }

    return result;
  }, [deferredSearch, game, category, sort, serviceList]);

  const displayedServices = filteredServices.slice(0, visibleCount);

  const hasMore = displayedServices.length < filteredServices.length;

  const progress =
    filteredServices.length === 0
      ? 0
      : Math.min(
          100,
          (displayedServices.length / filteredServices.length) * 100,
        );

  function clearFilters() {
    setSearch("");
    setGame(ALL_GAMES);
    setCategory(ALL_TYPES);
    setSort("featured");
  }

  function showMore() {
    setVisibleCount((current) =>
      Math.min(current + LOAD_MORE_AMOUNT, filteredServices.length),
    );
  }

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* HERO */}

      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <div className={styles.heroContent}>
          <div>
            <p className={styles.eyebrow}>BirdShop / Game services</p>

            <h1>Services</h1>

            <p className={styles.heroDescription}>
              Custom progression, building, coaching, and game services handled
              around your request — with clear communication from start to
              finish.
            </p>

            <div className={styles.heroFacts}>
              <span>
                <MessageIcon />
                Personal support
              </span>

              <span>
                <ClockIcon />
                Clear turnaround
              </span>

              <span>
                <ShieldIcon />
                Trusted service
              </span>
            </div>
          </div>

          <div className={styles.heroMark} aria-hidden="true">
            <span>BS</span>

            <div />

            <p>Game services</p>

            <small>
              Built around
              <br />
              your request
            </small>
          </div>
        </div>
      </section>

      {/* PROCESS */}

      <ol className={styles.processStrip} aria-label="How services work">
        <li>
          <span>01</span>

          <div>
            <strong>Choose a service</strong>
            <small>Browse the catalog</small>
          </div>
        </li>

        <li>
          <span>02</span>

          <div>
            <strong>Package or custom quote</strong>
            <small>Fixed price or tailored</small>
          </div>
        </li>

        <li>
          <span>03</span>

          <div>
            <strong>Pay securely</strong>
            <small>Checkout or approved quote</small>
          </div>
        </li>

        <li>
          <span>04</span>

          <div>
            <strong>Track it in chat</strong>
            <small>Private updates</small>
          </div>
        </li>
      </ol>

      {/* FEATURED */}

      {featuredServices.length > 0 && (
        <section className={styles.featuredSection}>
          <div className={styles.featuredHeading}>
            <div>
              <p>BirdShop picks</p>

              <h2>Featured services</h2>
            </div>

            <span>Popular ways to get started.</span>
          </div>

          <div
            className={styles.featuredGrid}
            data-count={featuredServices.length}
          >
            {featuredServices.map((service) => (
              <FeaturedServiceCard key={service.slug} service={service} />
            ))}
          </div>
        </section>
      )}

      {/* CATALOG */}

      <section className={styles.catalog} aria-labelledby="service-catalog-title">
        <div className={styles.catalogHeading}>
          <div>
            <p>Service catalog</p>

            <h2 id="service-catalog-title">Find your service</h2>
          </div>

          <span>
            {filteredServices.length}{" "}
            {filteredServices.length === 1 ? "service" : "services"}
          </span>
        </div>

        <div className={styles.catalogLayout}>
          <aside className={styles.sidebar}>
            <div className={styles.searchBox}>
              <SearchIcon />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services"
                aria-label="Search services"
              />
            </div>

            <div className={styles.filterBlock}>
              <p id="service-filter-game">Game</p>

              <div
                className={styles.filterList}
                role="group"
                aria-labelledby="service-filter-game"
              >
                {gameFilters.map(([item, count]) => {
                  const active = game === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setGame(item);
                        setVisibleCount(INITIAL_VISIBLE);
                      }}
                    >
                      <span>{item}</span>
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.filterBlock}>
              <p id="service-filter-type">Service type</p>

              <div
                className={styles.filterList}
                role="group"
                aria-labelledby="service-filter-type"
              >
                {categoryFilters.map(([item, count]) => {
                  const active = category === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setCategory(item);
                        setVisibleCount(INITIAL_VISIBLE);
                      }}
                    >
                      <span>{item}</span>
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.helpCard}>
              <span>Custom request</span>

              <h3>Don&apos;t see what you need?</h3>

              <p>
                Tell us what game and service you&apos;re looking for and we
                can discuss a custom request.
              </p>

              <Link href={CUSTOM_REQUEST_URL}>
                <MessageIcon />
                Request a Custom Quote
                <ArrowIcon />
              </Link>
            </div>
          </aside>

          <div className={styles.servicesArea}>
            <div className={styles.toolbar}>
              <p aria-live="polite">
                Showing <strong>{displayedServices.length}</strong> of{" "}
                <strong>{filteredServices.length}</strong> results
              </p>

              <label>
                <span>Sort by</span>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>

            {filteredServices.length > 0 ? (
              <>
                <div className={styles.serviceGrid}>
                  {displayedServices.map((service) => (
                    <ServiceCard key={service.slug} service={service} />
                  ))}
                </div>

                <div className={styles.loadMoreArea}>
                  <div className={styles.loadProgress} aria-hidden="true">
                    <div style={{ transform: `scaleX(${progress / 100})` }} />
                  </div>

                  <p>
                    Showing <strong>{displayedServices.length}</strong> of{" "}
                    <strong>{filteredServices.length}</strong> services
                  </p>

                  {hasMore ? (
                    <button
                      type="button"
                      onClick={showMore}
                      className={styles.loadMoreButton}
                    >
                      Show More Services
                      <span aria-hidden="true">↓</span>
                    </button>
                  ) : (
                    <div className={styles.allShown}>
                      <CheckIcon />
                      All services shown
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <span>No services found</span>

                <h3>Nothing matches those filters.</h3>

                <p>Try another game, service type, or search.</p>

                <button type="button" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* One forest photograph spans the request, the reassurance cards and the footer. */}
      <div className={styles.bottomScene}>
        <section className={styles.customRequest}>
          <div className={styles.customCopy}>
            <span>Need something different?</span>

            <h2>Request a custom service.</h2>

            <p>
              If your game or request isn&apos;t listed, contact BirdShop and
              explain what you need. We&apos;ll let you know whether the
              request can be handled and provide a quote.
            </p>
          </div>

          <div className={styles.customActions}>
            <Link href={CUSTOM_REQUEST_URL} className={styles.customPrimary}>
              <MessageIcon />
              Start a Custom Request
              <ArrowIcon />
            </Link>

            <p>Custom pricing depends on the game, scope, and turnaround.</p>

            <Link href={HOW_TO_ORDER_CUSTOM} className={styles.customHowLink}>
              How custom quotes work
            </Link>
          </div>
        </section>

        <section className={styles.trustSection} aria-label="Why BirdShop">
          <div>
            <MessageIcon />

            <h3>Clear communication</h3>

            <p>Discuss the request before work begins.</p>
          </div>

          <div>
            <ClockIcon />

            <h3>Realistic timing</h3>

            <p>Turnaround depends on the specific service.</p>
          </div>

          <div>
            <PeopleIcon />

            <h3>Fixed or custom</h3>

            <p>Buy a package or get a personal quote.</p>
          </div>

          <div>
            <ShieldIcon />

            <h3>BirdShop support</h3>

            <p>Help is available through Discord when needed.</p>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
