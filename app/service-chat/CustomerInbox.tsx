"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearServiceChatToken } from "@/lib/service-chat-session";
import styles from "./CustomerInbox.module.css";
type Conversation = {
  id: string;
  reference: string;
  subject: string | null;
  conversation_type: string;
  conversation_status: string;
  service_name: string | null;
  product_name: string | null;
  created_at: string;
};
type Inbox = {
  email: string;
  conversations: Conversation[];
  nextOffset: number | null;
};
export default function CustomerInbox() {
  const router = useRouter();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (offset = 0, signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/customer-inbox?offset=${offset}`, {
        cache: "no-store",
        signal,
      });
      const data = await response.json();
      if (signal?.aborted) return;
      setError("");
      if (response.status === 401) {
        setInbox(null);
        return;
      }
      if (!response.ok) throw new Error(data.error);
      setInbox((previous) =>
        offset && previous
          ? {
              ...data,
              conversations: [
                ...previous.conversations,
                ...data.conversations,
              ].filter(
                (c: Conversation, i: number, all: Conversation[]) =>
                  all.findIndex((x) => x.id === c.id) === i,
              ),
            }
          : data,
      );
    } catch (problem) {
      if (signal?.aborted) return;
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to load conversations.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(0, controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/customer-inbox/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(data.message);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to send your link.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openChat(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/customer-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id }),
      });
      const data = await response.json();
      if (response.status === 401) setInbox(null);
      if (!response.ok) throw new Error(data.error);
      router.push(data.url);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to open conversation.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/customer-inbox", { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error);
      clearServiceChatToken();
      setInbox(null);
      setNotice("");
      setEmail("");
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to sign out.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <span className={styles.eyebrow}>BIRDSHOP / PRIVATE INBOX</span>
        <h1>{inbox ? "Your conversations." : "Pick up where you left off."}</h1>
        {loading ? (
          <p role="status">Opening your inbox…</p>
        ) : inbox ? (
          <>
            <div className={styles.toolbar}>
              <p>
                Signed in as <strong>{inbox.email}</strong>
              </p>
              <button
                className={styles.secondary}
                onClick={signOut}
                disabled={busy}
              >
                Sign out & forget this device
              </button>
            </div>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/contact">
                Start a conversation
              </Link>
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await load();
                  setBusy(false);
                }}
              >
                Refresh inbox
              </button>
            </div>
            {inbox.conversations.length === 0 ? (
              <div className={styles.notice}>
                <strong>A fresh start.</strong>
                <p>
                  No conversations are linked to this email yet. Start a request
                  using this same email and it will appear here.
                </p>
              </div>
            ) : (
              <div className={styles.list}>
                {inbox.conversations.map((c) => (
                  <article className={styles.card} key={c.id}>
                    <div>
                      <div className={styles.meta}>
                        <span>{c.reference}</span>
                        <span className={styles.badge}>
                          {c.conversation_status === "closed"
                            ? "Closed"
                            : "Open"}
                        </span>
                      </div>
                      <h2>
                        {c.subject ||
                          c.service_name ||
                          c.product_name ||
                          (c.conversation_type === "product"
                            ? "Product support"
                            : c.conversation_type === "service"
                              ? "Service request"
                              : "General support")}
                      </h2>
                      <p>
                        {c.conversation_type === "product"
                          ? "Product support"
                          : c.conversation_type === "service"
                            ? "Services"
                            : "General support"}{" "}
                        ·{" "}
                        {new Date(c.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <button
                      className={styles.primary}
                      disabled={busy}
                      onClick={() => openChat(c.id)}
                    >
                      {c.conversation_status === "closed"
                        ? "View conversation"
                        : "Continue conversation"}
                      <span aria-hidden="true"> →</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
            {inbox.nextOffset !== null && (
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await load(inbox.nextOffset!);
                  setBusy(false);
                }}
              >
                Load more conversations
              </button>
            )}
          </>
        ) : (
          <>
            <p className={styles.intro}>
              All your BirdShop conversations, in one place. Verify your email
              once to open your private inbox.
            </p>
            <form className={styles.form} onSubmit={requestLink}>
              <label htmlFor="inbox-email">Your email address</label>
              <input
                id="inbox-email"
                type="email"
                autoComplete="email"
                maxLength={320}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <button className={styles.primary} disabled={busy}>
                {busy
                  ? "Sending your link…"
                  : notice
                    ? "Send another sign-in link"
                    : "Email my sign-in link"}
              </button>
            </form>
            {notice && (
              <div className={styles.notice} role="status">
                <strong>Check your inbox</strong>
                <p>{notice}</p>
              </div>
            )}
            <p className={styles.hint}>
              Choose “Remember this device” after verifying to come straight
              back here next time.
            </p>
            <Link className={styles.textLink} href="/contact">
              New here? Start a conversation →
            </Link>
          </>
        )}
        {error && (
          <div className={styles.error} role="alert">
            {error}{" "}
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={() => void load()}
            >
              Retry inbox
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
