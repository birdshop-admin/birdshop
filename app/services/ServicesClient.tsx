"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import {
  SearchIcon,
  CheckIcon,
  ClockIcon,
  MessageIcon,
  ShieldIcon,
  PeopleIcon,
  DiscordIcon,
  ArrowIcon,
} from "@/components/SiteIcons";
import ServiceCardPlanControls from "@/components/ServiceCardPlanControls";

import type { Service } from "@/lib/services";

import styles from "./services.module.css";

const INITIAL_VISIBLE = 8;
const LOAD_MORE_AMOUNT = 8;

/* =========================================================
   FEATURED CARD
========================================================= */

function FeaturedServiceCard({ service }: { service: Service }) {
  return (
    <article className={styles.featuredCard}>
      <Link
        href={`/services/${service.slug}`}
        className={styles.cardOverlay}
        aria-label={`View ${service.name}`}
      />

      <div className={styles.featuredVisual}>
        <span className={styles.featuredBadge}>
          {service.badge ?? "FEATURED"}
        </span>

        <strong>{service.initials}</strong>

        <small>{service.game}</small>
      </div>

      <div className={styles.featuredInfo}>
        <span className={styles.featuredCategory}>{service.category}</span>

        <h3>{service.name}</h3>

        <p>{service.shortDescription}</p>

        <div className={styles.featuredBottom}>
          <strong>
            {service.startingPrice !== null
              ? `From $${service.startingPrice.toFixed(2)}`
              : "Custom Quote"}
          </strong>

          <Link href={`/services/${service.slug}`}>
            {service.customOnly ? "View Service" : "View Plans"}
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
  return (
    <article className={styles.serviceCard}>
      {/* WHOLE CARD OPENS DETAILS */}

      <Link
        href={`/services/${service.slug}`}
        className={styles.cardOverlay}
        aria-label={`View ${service.name} plans`}
      />

      <div className={styles.serviceVisual}>
        <div className={styles.visualGlow} />

        {service.badge && (
          <span className={styles.serviceBadge}>{service.badge}</span>
        )}

        <span className={styles.visualGame}>{service.game}</span>

        <strong>{service.initials}</strong>

        <span className={styles.visualType}>{service.category}</span>
      </div>

      <div className={styles.serviceBody}>
        <div className={styles.serviceMeta}>
          <span>{service.game}</span>

          <span className={styles.available}>
            <CheckIcon />
            {service.available ? "AVAILABLE" : "PAUSED"}
          </span>
        </div>

        <h3>{service.name}</h3>

        <p className={styles.serviceDescription}>{service.shortDescription}</p>

        <div className={styles.features}>
          {service.features.slice(0, 3).map((feature) => (
            <span key={feature}>
              <CheckIcon />

              {feature}
            </span>
          ))}
        </div>

        {/* CLICKABLE TIERS + LIVE PRICE */}

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
  const serviceGames = [
    "All Services",
    ...new Set(serviceList.map((s) => s.game)),
  ];
  const serviceCategories = [
    "All Types",
    ...new Set(serviceList.map((s) => s.category)),
  ];
  const [search, setSearch] = useState("");

  const [game, setGame] = useState("All Services");

  const [category, setCategory] = useState("All Types");

  const [sort, setSort] = useState("featured");

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const featuredServices = serviceList
    .filter((service) => service.featured)
    .slice(0, 3);

  const filteredServices = useMemo(() => {
    let result = serviceList.filter((service) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        query.length === 0 ||
        service.name.toLowerCase().includes(query) ||
        service.game.toLowerCase().includes(query) ||
        service.category.toLowerCase().includes(query);

      const matchesGame = game === "All Services" || service.game === game;

      const matchesCategory =
        category === "All Types" || service.category === category;

      return matchesSearch && matchesGame && matchesCategory;
    });

    if (sort === "price-low") {
      result = [...result].sort((a, b) => {
        if (a.startingPrice === null) {
          return 1;
        }

        if (b.startingPrice === null) {
          return -1;
        }

        return a.startingPrice - b.startingPrice;
      });
    }

    if (sort === "price-high") {
      result = [...result].sort((a, b) => {
        if (a.startingPrice === null) {
          return 1;
        }

        if (b.startingPrice === null) {
          return -1;
        }

        return b.startingPrice - a.startingPrice;
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
  }, [search, game, category, sort, serviceList]);

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

    setGame("All Services");

    setCategory("All Types");

    setSort("featured");
  }

  function showMore() {
    setVisibleCount((current) =>
      Math.min(
        current + LOAD_MORE_AMOUNT,

        filteredServices.length,
      ),
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
            <p className={styles.eyebrow}>BIRDSHOP / GAME SERVICES</p>

            <h1>Services</h1>

            <p className={styles.heroDescription}>
              Custom progression, building, coaching, and game services handled
              around your request — with clear communication from start to
              finish.
            </p>

            <div className={styles.heroFacts}>
              <span>
                <MessageIcon />
                Personal Support
              </span>

              <span>
                <ClockIcon />
                Clear Turnaround
              </span>

              <span>
                <ShieldIcon />
                Trusted Service
              </span>
            </div>
          </div>

          <div className={styles.heroMark}>
            <span>BS</span>

            <div />

            <p>GAME SERVICES</p>

            <small>
              BUILT AROUND
              <br />
              YOUR REQUEST
            </small>
          </div>
        </div>
      </section>

      {/* PROCESS */}

      <section className={styles.processStrip}>
        <div>
          <span>01</span>

          <div>
            <strong>Choose a Service</strong>

            <small>FIND THE RIGHT OPTION</small>
          </div>
        </div>

        <div>
          <span>02</span>

          <div>
            <strong>Compare Plans</strong>

            <small>SEE WHAT IS INCLUDED</small>
          </div>
        </div>

        <div>
          <span>03</span>

          <div>
            <strong>Confirm the Details</strong>

            <small>FINALIZE YOUR REQUEST</small>
          </div>
        </div>

        <div>
          <span>04</span>

          <div>
            <strong>Service Begins</strong>

            <small>RECEIVE UPDATES</small>
          </div>
        </div>
      </section>

      {/* FEATURED */}

      <section className={styles.featuredSection}>
        <div className={styles.featuredHeading}>
          <div>
            <p>BIRDSHOP PICKS</p>

            <h2>Featured Services</h2>
          </div>

          <span>Popular ways to get started.</span>
        </div>

        <div className={styles.featuredGrid}>
          {featuredServices.map((service) => (
            <FeaturedServiceCard key={service.slug} service={service} />
          ))}
        </div>
      </section>

      {/* CATALOG */}

      <section className={styles.catalog}>
        <div className={styles.catalogHeading}>
          <div>
            <p>SERVICE CATALOG</p>

            <h2>Find Your Service</h2>
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
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services"
              />
            </div>

            <div className={styles.filterBlock}>
              <p>GAME</p>

              <div className={styles.filterList}>
                {serviceGames.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setGame(item);
                      setVisibleCount(INITIAL_VISIBLE);
                    }}
                    className={game === item ? styles.activeFilter : ""}
                  >
                    <span>{item}</span>

                    <span>
                      {item === "All Services"
                        ? serviceList.length
                        : serviceList.filter((service) => service.game === item)
                            .length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterBlock}>
              <p>SERVICE TYPE</p>

              <div className={styles.filterList}>
                {serviceCategories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setCategory(item);
                      setVisibleCount(INITIAL_VISIBLE);
                    }}
                    className={category === item ? styles.activeFilter : ""}
                  >
                    <span>{item}</span>

                    <span>
                      {item === "All Types"
                        ? serviceList.length
                        : serviceList.filter(
                            (service) => service.category === item,
                          ).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.helpCard}>
              <span>CUSTOM REQUEST</span>

              <h3>Don&apos;t see what you need?</h3>

              <p>
                Tell us what game and service you&apos;re looking for and we can
                discuss a custom request.
              </p>

              <Link href="/contact">
                <DiscordIcon />
                Ask on Discord
                <ArrowIcon />
              </Link>
            </div>
          </aside>

          <div className={styles.servicesArea}>
            <div className={styles.toolbar}>
              <p>
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
                  <div className={styles.loadProgress}>
                    <div
                      style={{
                        width: `${progress}%`,
                      }}
                    />
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
                      <span>↓</span>
                    </button>
                  ) : (
                    <div className={styles.allShown}>
                      <CheckIcon />
                      All Services Shown
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <span>NO SERVICES FOUND</span>

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

      <div className={styles.bottomScene}>
      {/* CUSTOM */}

      <section className={styles.customRequest}>
        <div className={styles.customGlow} />

        <div className={styles.customCopy}>
          <span>NEED SOMETHING DIFFERENT?</span>

          <h2>Request a custom service.</h2>

          <p>
            If your game or request isn&apos;t listed, contact BirdShop and
            explain what you need. We&apos;ll let you know whether the request
            can be handled and provide a quote.
          </p>
        </div>

        <div className={styles.customActions}>
          <Link href="/contact" className={styles.customPrimary}>
            <DiscordIcon />
            Start a Request
            <ArrowIcon />
          </Link>

          <p>Custom pricing depends on the game, scope, and turnaround.</p>
        </div>
      </section>

      {/* TRUST */}

      <section className={styles.trustSection}>
        <div>
          <MessageIcon />

          <h3>Clear Communication</h3>

          <p>Discuss the request before work begins.</p>
        </div>

        <div>
          <ClockIcon />

          <h3>Realistic Timing</h3>

          <p>Turnaround depends on the specific service.</p>
        </div>

        <div>
          <PeopleIcon />

          <h3>Flexible Plans</h3>

          <p>Compare available tiers before starting.</p>
        </div>

        <div>
          <ShieldIcon />

          <h3>BirdShop Support</h3>

          <p>Help is available through Discord when needed.</p>
        </div>
      </section>

      <SiteFooter />
      </div>
    </main>
  );
}
