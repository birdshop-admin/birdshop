"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Service, ServicePlan } from "@/lib/services";
import s from "./purchase.module.css";

export default function Purchase({
  service,
  plan,
}: {
  service: Service;
  plan: ServicePlan;
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

      const result = await response.json();

      if (!response.ok) {
        if (result.chatUrl) setChat(result.chatUrl);
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

  return (
    <section className={s.layout}>
      <div>
        <Link href={`/services/${service.slug}`}>← Back to plans</Link>

        <span className={s.eyebrow}>YOUR NEXT STEP</span>

        <h1>{service.name}</h1>
        <h2>{plan.name} package</h2>

        <p>{plan.scope}</p>

        <ul>
          {plan.includes.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>

        <p>
          After secure payment, you return directly to a private BirdShop chat
          to share details and arrange the work. Keep your email for recovery
          and receipts.
        </p>

        <p>Turnaround: {service.turnaround}</p>
      </div>

      <form className={s.card} onSubmit={submit}>
        <span className={s.eyebrow}>SECURE SERVICE PURCHASE</span>

        <h2>
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(plan.cents! / 100)}
        </h2>

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

        <button disabled={busy || completed}>
          {busy
            ? "Opening checkout…"
            : completed
              ? "Already purchased"
              : "Pay securely & open chat"}
        </button>

        <small>
          Your order is created after payment is confirmed. No account password
          is needed here.
        </small>

        {completed && (
          <div role="status">
            <p>
              You have already purchased this package. Open your chat below,
              or start another purchase.
            </p>

            <button type="button" onClick={buyAgain}>
              Buy this package again
            </button>
          </div>
        )}

        {error && <p role="alert">{error}</p>}

        {chat && (
          <Link href={chat}>Continue to your private chat →</Link>
        )}
      </form>
    </section>
  );
}