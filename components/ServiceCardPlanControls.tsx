"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ArrowIcon, CheckIcon } from "@/components/SiteIcons";
import { formatUSD } from "@/lib/money";
import type { Service } from "@/lib/services";
import {
  HOW_TO_ORDER_CUSTOM,
  buildServicePackages,
  getDefaultServicePackageId,
  isQuoteOnly,
  servicePackageHref,
  serviceQuoteHref,
  type ServicePackageTier,
} from "@/lib/service-packages";

import styles from "./ServiceCardPlanControls.module.css";

/*
 * Package controls on a catalog card. Two modes, both decided by isQuoteOnly:
 * - Fixed packages: published tiers + Custom, a live price preview and a buy CTA.
 * - Custom quote only: no tiers at all, a quote panel and "Request a Quote".
 * Customer copy never says "plan" or "tier".
 */

function tierClass(tier: ServicePackageTier) {
  switch (tier) {
    case "starter":
      return styles.starter;
    case "standard":
      return styles.standard;
    case "premium":
      return styles.premium;
    default:
      return styles.custom;
  }
}

export default function ServiceCardPlanControls({
  service,
}: {
  service: Service;
}) {
  const packages = useMemo(() => buildServicePackages(service), [service]);

  const [selectedPackage, setSelectedPackage] = useState(() =>
    getDefaultServicePackageId(packages),
  );

  const detailUrl = `/services/${service.slug}`;

  /* ---------------------------------------------------------
     CUSTOM QUOTE ONLY
  --------------------------------------------------------- */

  if (isQuoteOnly(service)) {
    return (
      <div className={`${styles.controls} ${styles.custom}`}>
        <div className={styles.heading}>
          <span>Custom quote</span>
          <small>No fixed packages</small>
        </div>

        <div className={styles.quotePanel}>
          <div>
            <span>Tailored to you</span>
            <p>
              Tell us what you need. Scope, price and timing are confirmed
              before you pay.
            </p>
          </div>

          <strong>By quote</strong>
        </div>

        <div className={styles.actions}>
          {service.available ? (
            <Link
              href={serviceQuoteHref(service.slug)}
              className={styles.primary}
            >
              Request a Quote
              <ArrowIcon />
            </Link>
          ) : (
            <button type="button" className={styles.primary} disabled>
              Currently Unavailable
            </button>
          )}

          <Link href={detailUrl} className={styles.secondary}>
            View Service
          </Link>
        </div>

        <Link href={HOW_TO_ORDER_CUSTOM} className={styles.howLink}>
          How custom quotes work
        </Link>
      </div>
    );
  }

  /* ---------------------------------------------------------
     FIXED PACKAGES
  --------------------------------------------------------- */

  const currentPackage =
    packages.find((item) => item.id === selectedPackage) ?? packages[0];

  if (!currentPackage) return null;

  const isCustom = currentPackage.tier === "custom";
  const canContinue =
    service.available && (isCustom || currentPackage.purchasable === true);

  return (
    <div className={styles.controls}>
      <div className={styles.heading}>
        <span>Service packages</span>
        <small>Select to preview price</small>
      </div>

      {/* Published tiers share one row; Custom quote takes the row below. */}
      <div
        className={styles.tiers}
        role="group"
        aria-label={`${service.name} packages`}
        data-count={packages.filter((option) => option.tier !== "custom").length}
      >
        {packages.map((option) => {
          const active = option.id === currentPackage.id;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              className={`${styles.tierButton} ${tierClass(option.tier)}`}
              onClick={(event) => {
                // The card behind is one big link; a package pick must not open it.
                event.preventDefault();
                event.stopPropagation();
                setSelectedPackage(option.id);
              }}
            >
              <i aria-hidden="true" />
              <span>{option.tier === "custom" ? "Custom quote" : option.name}</span>
              {active && <CheckIcon />}
            </button>
          );
        })}
      </div>

      <div
        className={`${styles.pricePreview} ${tierClass(currentPackage.tier)}`}
        aria-live="polite"
      >
        <div>
          <span>{isCustom ? "Custom quote" : currentPackage.label}</span>
          <small>{currentPackage.scope}</small>
        </div>

        <strong>
          {currentPackage.price !== null
            ? formatUSD(currentPackage.price)
            : "By quote"}
        </strong>
      </div>

      <div className={styles.actions}>
        {canContinue ? (
          <Link
            href={servicePackageHref(service.slug, currentPackage)}
            className={styles.primary}
          >
            {isCustom ? "Request a Quote" : `Buy ${currentPackage.name}`}
            <ArrowIcon />
          </Link>
        ) : (
          <button type="button" className={styles.primary} disabled>
            Currently Unavailable
          </button>
        )}

        <Link href={detailUrl} className={styles.secondary}>
          View Packages
        </Link>
      </div>
    </div>
  );
}
