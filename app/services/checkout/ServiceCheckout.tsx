"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startVisiblePoll } from "@/lib/visible-poll";
import s from "../[slug]/purchase/purchase.module.css";

type State = { status: string; cancelling: boolean; title: string; amount: number; currency: string; chatUrl: string | null; url: string | null };
export default function ServiceCheckout() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const terminal = state && ["expired", "cancelled", "failed"].includes(state.status);
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    return startVisiblePoll(async (signal) => {
      if (lock.current) return;
      lock.current = true;
      try {
        const response = await fetch("/api/services/checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action: "check" }), signal,
        });
        const data: State & { error?: string } = await response.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." }));
        if (!response.ok) throw new Error(data.error || "Please retry in a moment.");
        if (signal.aborted) return;
        setState(data); setError("");
        if (data.chatUrl) { router.replace(data.chatUrl); return false; }
        if (["expired", "cancelled", "failed"].includes(data.status)) return false;
      } catch (e) {
        if (!signal.aborted) setError(e instanceof Error ? e.message : "Please retry.");
      } finally { lock.current = false; }
    }, 5000);
  }, [token, router]);
  async function act(action: "resume" | "cancel") {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/services/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const data = await response.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." }));
      if (!response.ok) throw new Error(data.error || "Please retry in a moment.");
      setState(data);
      if (data.chatUrl) router.replace(data.chatUrl);
      else if (data.url) window.location.assign(data.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Please retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  function startAgain() {
    // Explicit new purchase only after the previous attempt is terminal.
    if (terminal) sessionStorage.removeItem("birdshop-service-purchase");
  }
  return <section className={s.layout}>
    <div className={s.summary}><span className={s.eyebrow}>Service purchase</span>
      <h1>{terminal ? "Checkout closed" : "Your next step starts here"}</h1>
      <p>Your private chat opens automatically after payment is confirmed. Work begins after we discuss your requirements.</p>
      <p><Link href="/services" onClick={startAgain} className={s.back}><span aria-hidden="true">←</span>Back to services</Link></p>
    </div>
    <div className={s.card} aria-busy={busy}>
      <span className={s.eyebrow}>Payment status</span>
      <h2>{state?.title ?? "Checking your checkout…"}</h2>
      {state && <strong className={s.amount}>{new Intl.NumberFormat("en-US", { style: "currency", currency: state.currency }).format(state.amount)}</strong>}
      <p role="status" className={s.status}>{terminal ? "No purchase was completed for this checkout. You can select a service again."
        : state?.status === "paid" ? "Payment confirmed. Preparing your private chat…"
        : state?.cancelling ? "Confirming cancellation…"
        : state?.status === "processing" ? "Confirming your payment. Please do not pay again."
        : "Complete secure checkout to unlock your private chat."}</p>
      {state && !terminal && !state.cancelling && ["creating", "open"].includes(state.status) &&
        <button type="button" className={s.primary} disabled={busy} onClick={() => void act("resume")}>Continue Payment</button>}
      {state && !terminal && state.status !== "paid" &&
        <button type="button" className={s.secondary} disabled={busy} onClick={() => void act("cancel")}>Cancel Checkout</button>}
      {error && <p role="alert">{error}</p>}
      {!/^[a-f0-9]{64}$/.test(token) && <p role="alert">This checkout link is unavailable. Return to services or contact BirdShop.</p>}
    </div>
  </section>;
}
