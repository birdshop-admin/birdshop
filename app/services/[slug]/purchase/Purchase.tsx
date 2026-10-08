"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import CatalogArtwork from "@/components/CatalogArtwork";
import { ArrowIcon, CheckIcon, MessageIcon, ShieldIcon } from "@/components/SiteIcons";
import { formatUSD } from "@/lib/money";
import {
  HOW_TO_ORDER_PACKAGES,
  type PublishedServicePlan,
} from "@/lib/service-packages";
import type { Service } from "@/lib/services";

import s from "./purchase.module.css";

/*
 * Fixed-package purchase. The page only renders this for a published package
 * of an available, non-quote-only service; checkout re-validates the price.
 * Copy never says "plan" or "tier".
 */
export default function Purchase({
  service,
  plan,
}: {
  service: Service;
  plan: PublishedServicePlan;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chat, setChat] = useState("");
  const [completed, setCompleted] = useState(false);

  const submitting = useRef(false);

  const memory = useRef<{
    fingerprint: string;
    id: string;
  } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting.current || completed) return;

    submitting.current = true;
    setBusy(true);
    setError("");
    setChat("");

    const f = new FormData(e.currentTarget);

    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "")
      .trim()
      .toLowerCase();

    const fingerprint = JSON.stringify([
      service.slug,
      plan.id,
      plan.cents,
      name,
      email,
    ]);

    try {
      if (!memory.current || memory.current.fingerprint !== fingerprint) {
        let saved;

        try {
          saved = JSON.parse(
            sessionStorage.getItem("birdshop-service-purchase") ?? "null",
          );
        } catch {}

        memory.current =
          saved?.fingerprint === fingerprint &&
          typeof saved.id === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            saved.id,
          )
            ? saved
            : {
                fingerprint,
                id: crypto.randomUUID(),
              };

        try {
          sessionStorage.setItem(
            "birdshop-service-purchase",
            JSON.stringify(memory.current),
          );
        } catch {}
      }

      const response = await fetch("/api/services/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: memory.current!.id,
          slug: service.slug,
          tier: plan.id,
          expectedCents: plan.cents,
          name,
          email,
        }),
      });

      const result = await response.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." }));

      if (!response.ok) {
        // Unpaid failures must never expose a private chat.
        throw Error(result.error ?? "Please retry.");
      }

      if (result.completed === true) {
        setCompleted(true);
        setChat(result.url);
        return;
      }

      window.location.assign(result.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Checkout could not open. Please retry.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function buyAgain() {
    if (submitting.current || !memory.current) return;

    memory.current = {
      fingerprint: memory.current.fingerprint,
      id: crypto.randomUUID(),
    };

    try {
      sessionStorage.setItem(
        "birdshop-service-purchase",
        JSON.stringify(memory.current),
      );
    } catch {}

    setCompleted(false);
    setChat("");
    setError("");
  }

  const includes = plan.includes.filter((item) => item.trim().length > 0);

  return (
    <section className={s.layout}>
      <div className={s.summary}>
        <Link href={`/services/${service.slug}`} className={s.back}>
          <span aria-hidden="true">←</span>
          Back to {service.name}
        </Link>

        {service.image && (
          <div className={s.thumb}>
            <CatalogArtwork
              src={service.image}
              sizes="(max-width: 760px) 92vw, 560px"
              fallback={
                <span className="catalog-artwork-fallback" aria-hidden="true">
                  {service.initials}
                </span>
              }
            />
          </div>
        )}

        <span className={s.eyebrow}>Your next step</span>

        <h1>{service.name}</h1>

        <h2 className={s.packageName}>{plan.name} package</h2>

        <p className={s.scope}>{plan.scope}</p>

        {includes.length > 0 && (
          <ul className={s.includes}>
            {includes.map((item, index) => (
              <li key={`${index}-${item}`}>
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        <p>
          After secure payment, you return directly to a private BirdShop chat
          to share details and arrange the work. Keep your email for recovery
          and receipts.
        </p>

        <dl className={s.facts}>
          <div>
            <dt>Turnaround</dt>
            <dd>{service.turnaround}</dd>
          </div>

          <div>
            <dt>Delivery</dt>
            <dd>{service.delivery}</dd>
          </div>
        </dl>

        <Link href={HOW_TO_ORDER_PACKAGES} className={s.textLink}>
          How package orders work
        </Link>
      </div>

      <form className={s.card} onSubmit={submit} aria-busy={busy}>
        <span className={s.eyebrow}>Secure service purchase</span>

        <div className={s.priceBlock}>
          <strong className={s.price}>{formatUSD(plan.cents / 100)}</strong>
          <span>{plan.name} package · USD</span>
        </div>

        <label>
          Your name
          <input
            name="name"
            disabled={busy || completed}
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
          />
        </label>

        <label>
          Email
          <input
            name="email"
            disabled={busy || completed}
            type="email"
            required
            maxLength={320}
            autoComplete="email"
          />
        </label>

        <button
          type="submit"
          className={s.primary}
          disabled={busy || completed}
        >
          <ShieldIcon />
          {busy
            ? "Opening Checkout…"
            : completed
              ? "Already Purchased"
              : "Pay Securely & Open Chat"}
        </button>

        <ul className={s.trust}>
          <li>
            <ShieldIcon />
            Secure Stripe checkout
          </li>

          <li>
            <MessageIcon />
            Private chat unlocks after payment
          </li>

          <li>
            <CheckIcon />
            Payment confirmation by email
          </li>
        </ul>

        <small>
          Your order is created after payment is confirmed. No account password
          is needed here.
        </small>

        {completed && (
          <div role="status" className={s.notice}>
            <p>
              You have already purchased this package. Open your chat below,
              or start another purchase.
            </p>

            <button type="button" className={s.secondary} onClick={buyAgain}>
              Buy This Package Again
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}

        {chat && (
          <Link href={chat} className={s.primary}>
            Continue to Your Private Chat
            <ArrowIcon />
          </Link>
        )}
      </form>
    </section>
  );
}