"use client";

import Link from "next/link";
import { useState } from "react";

import CatalogArtwork from "@/components/CatalogArtwork";
import { ArrowIcon } from "@/components/SiteIcons";
import { publishedTiers } from "@/lib/service-packages";
import type { Service } from "@/lib/services";

import ServiceEditor from "./ServiceEditor";
import s from "./services.module.css";

type Entry = { service: Service; visible: boolean };

type Filter = "all" | "visible" | "hidden" | "custom" | "setup";

/* What customers see, by the same rule as the storefront (isQuoteOnly). */
function pricingOf(service: Service) {
  const live = publishedTiers(service).length;

  if (service.customOnly) {
    return { mode: "custom", label: "Custom quote only", live } as const;
  }

  if (live === 0) {
    return {
      mode: "none",
      label: "No packages live · shows as custom quote",
      live,
    } as const;
  }

  return { mode: "tiers", label: `${live} of 3 packages live`, live } as const;
}

function matches(filter: Filter, { service, visible }: Entry) {
  switch (filter) {
    case "visible":
      return visible;
    case "hidden":
      return !visible;
    case "custom":
      return service.customOnly === true;
    case "setup":
      return !service.customOnly && publishedTiers(service).length < 3;
    default:
      return true;
  }
}

export default function ServiceCatalog({ services }: { services: Entry[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const needle = query.trim().toLowerCase();

  const filtered = services.filter(
    (entry) =>
      `${entry.service.name} ${entry.service.game} ${entry.service.category}`
        .toLowerCase()
        .includes(needle) && matches(filter, entry),
  );

  const metrics: Array<[string, number]> = [
    ["Services", services.length],
    ["Visible", services.filter((entry) => entry.visible).length],
    [
      "Packages live",
      services.reduce(
        (total, entry) => total + publishedTiers(entry.service).length,
        0,
      ),
    ],
    [
      "Custom quote only",
      services.filter((entry) => entry.service.customOnly === true).length,
    ],
  ];

  return (
    <div className={s.catalog}>
      <div className={s.metrics}>
        {metrics.map(([label, count]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>

      <details className={s.newService}>
        <summary>
          <span>
            <b>＋ Add a new service</b>
            <small>
              Create a service with fixed packages, or one that is custom quote
              only.
            </small>
          </span>

          <span className={s.expand} aria-hidden="true">
            +
          </span>
        </summary>

        <ServiceEditor />
      </details>

      <section className={s.catalogPanel}>
        <header className={s.catalogHeader}>
          <div>
            <span>Your catalog</span>

            <h2>Services &amp; packages</h2>

            <p>
              Open a service, choose Fixed packages or Custom quote only, add
              an image, then save.
            </p>
          </div>

          <Link href="/services" target="_blank" rel="noreferrer">
            View Storefront <ArrowIcon />
          </Link>
        </header>

        <div className={s.toolbar}>
          <label>
            <span>Find a service</span>

            <input
              type="search"
              placeholder="Search name, game or category…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label>
            <span>Show</span>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
            >
              <option value="all">All services</option>
              <option value="visible">Visible services</option>
              <option value="hidden">Hidden services</option>
              <option value="custom">Custom quote only</option>
              <option value="setup">Packages to set up</option>
            </select>
          </label>

          <p>
            {filtered.length} of {services.length} services
          </p>
        </div>

        <div className={s.serviceList}>
          {filtered.map(({ service, visible }) => {
            const pricing = pricingOf(service);
            const state = !visible
              ? "hidden"
              : !service.available
                ? "paused"
                : "live";

            return (
              <details className={s.serviceRow} key={service.slug}>
                <summary>
                  <span className={s.monogram} aria-hidden="true">
                    <CatalogArtwork
                      src={service.image}
                      sizes="49px"
                      fallback={service.initials}
                    />
                  </span>

                  <span className={s.serviceName}>
                    <small>
                      {service.game} · {service.category}
                    </small>

                    <strong>{service.name}</strong>

                    <span className={s.pricingBadge} data-mode={pricing.mode}>
                      {pricing.label}
                    </span>
                  </span>

                  <span className={s.status} data-state={state}>
                    {state === "hidden"
                      ? "Hidden"
                      : state === "paused"
                        ? "Paused"
                        : "Visible"}
                  </span>

                  <span className={s.expand} aria-hidden="true">
                    +
                  </span>
                </summary>

                <ServiceEditor service={service} visible={visible} />
              </details>
            );
          })}
        </div>

        {!filtered.length && (
          <p className={s.empty}>
            No services match. Try another search or add a new service.
          </p>
        )}
      </section>
    </div>
  );
}
