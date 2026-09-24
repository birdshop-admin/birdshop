"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import {
  CheckIcon,
  ArrowIcon,
} from "@/components/SiteIcons";

import type {
  Service,
} from "@/lib/services";

import {
  buildServicePackages,
  getDefaultServicePackageId,
  type ServicePackageTier,
} from "@/lib/service-packages";

import styles from "./ServiceCardPlanControls.module.css";

/* =========================================================
   TIER CLASS
========================================================= */

function tierClass(
  tier: ServicePackageTier
) {
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

/* =========================================================
   COMPONENT
========================================================= */

export default function ServiceCardPlanControls({
  service,
}: {
  service: Service;
}) {
  const packages =
    useMemo(
      () =>
        buildServicePackages(
          service
        ),
      [service]
    );

  const defaultPackageId =
    getDefaultServicePackageId(
      packages
    );

  const [
    selectedPackage,
    setSelectedPackage,
  ] = useState(
    defaultPackageId
  );

  const currentPackage =
    packages.find(
      (item) =>
        item.id ===
        selectedPackage
    ) ??
    packages[0];

  if (!currentPackage) {
    return null;
  }

  /*
    IMPORTANT:

    View Plans intentionally DOES NOT include:
    ?package=standard
    ?package=premium

    The detail page should always begin from Starter.

    Get Started DOES preserve the selected package because
    the user is deliberately skipping directly to contact.
  */

  const plansUrl =
    `/services/${service.slug}`;

  const requestUrl =
    `/contact?service=${encodeURIComponent(
      service.slug
    )}&package=${encodeURIComponent(
      currentPackage.id
    )}`;

  return (
    <div
      className={
        styles.controls
      }
    >
      {/* HEADER */}

      <div
        className={
          styles.heading
        }
      >
        <span>
          AVAILABLE PLANS
        </span>

        <small>
          Select to preview price
        </small>
      </div>

      {/* ===================================================
          TIER BUTTONS
      =================================================== */}

      <div
        className={
          styles.tiers
        }
      >
        {packages.map(
          (option) => {
            const active =
              option.id ===
              currentPackage.id;

            return (
              <button
                key={
                  option.id
                }
                type="button"
                className={`${styles.tierButton} ${tierClass(
                  option.tier
                )} ${
                  active
                    ? styles.active
                    : ""
                }`}
                onClick={(
                  event
                ) => {
                  /*
                    The whole parent service card is clickable.

                    These stop calls prevent clicking a tier
                    from accidentally opening the service page.
                  */

                  event.preventDefault();

                  event.stopPropagation();

                  setSelectedPackage(
                    option.id
                  );
                }}
              >
                <span>
                  {
                    option.name
                  }
                </span>

                {active && (
                  <CheckIcon />
                )}
              </button>
            );
          }
        )}
      </div>

      {/* ===================================================
          LIVE PRICE PREVIEW
      =================================================== */}

      <div
        className={`${styles.pricePreview} ${tierClass(
          currentPackage.tier
        )}`}
      >
        <div>
          <span>
            {
              currentPackage.name
            }{" "}
            PLAN
          </span>

          <small>
            {
              currentPackage.scope
            }
          </small>
        </div>

        <strong>
          {currentPackage.price !==
          null
            ? `$${currentPackage.price.toFixed(
                2
              )}`
            : "Custom Quote"}
        </strong>
      </div>

      {/* ===================================================
          ACTIONS
      =================================================== */}

      <div
        className={
          styles.actions
        }
      >
        <Link
          href={
            plansUrl
          }
          className={
            styles.viewPlans
          }
        >
          View Plans

          <ArrowIcon />
        </Link>

        <Link
          href={
            requestUrl
          }
          className={
            styles.getStarted
          }
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}