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
type List = { conversations: Conversation[]; nextOffset: number | null };
type Inbox = List & { email: string };
type Source = "device" | "email";
const emptyList: List = { conversations: [], nextOffset: null };
function merge(previous: List, next: List): List {
  return {
    ...next,
    conversations: [...previous.conversations, ...next.conversations].filter(
      (c, i, all) => all.findIndex((x) => x.id === c.id) === i,
    ),
  };
}
export default function CustomerInbox() {
  const router = useRouter();
  const [device, setDevice] = useState<List>(emptyList),
    [inbox, setInbox] = useState<Inbox | null>(null),
    [tab, setTab] = useState<Source>("device");
  const [email, setEmail] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      fetch("/api/customer-device", { cache: "no-store", signal }).then(
        async (r) => ({ ok: r.ok, status: r.status, data: await r.json() }),
      ),
      fetch("/api/customer-inbox", { cache: "no-store", signal }).then(
        async (r) => ({ ok: r.ok, status: r.status, data: await r.json() }),
      ),
    ]);
    if (signal?.aborted) return;
    const [d, e] = results;
    const problems: string[] = [];
    let deviceCount = 0;
    if (d.status === "fulfilled" && d.value.ok) {
      setDevice(d.value.data);
      deviceCount = d.value.data.conversations.length;
    } else {
      setDevice(emptyList);
      problems.push(
        "Saved chats could not be loaded. Try refreshing your inbox.",
      );
    }
    if (e.status === "fulfilled" && e.value.ok) {
      setInbox(e.value.data);
      if (!deviceCount) setTab("email");
    } else if (e.status === "fulfilled" && e.value.status === 401) {
      setInbox(null);
      setTab("device");
    } else {
      setInbox(null);
      problems.push(
        "Email inbox could not be loaded. Try refreshing your inbox.",
      );
    }
    setError(problems.join(" "));
    setLoading(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
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
      const response = await fetch(
        tab === "device" ? "/api/customer-device" : "/api/customer-inbox",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "open", conversationId: id }),
        },
      );
      const data = await response.json();
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
  async function forget(id?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Whole-device removal signs out the email inbox too, so access is not retained there.
      const response = await fetch(
        id
          ? `/api/customer-device?conversationId=${encodeURIComponent(id)}`
          : "/api/customer-inbox",
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      clearServiceChatToken();
      setNotice("");
      await load();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to forget saved access.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadMore() {
    const current = tab === "device" ? device : inbox;
    if (!current || current.nextOffset === null || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${tab === "device" ? "/api/customer-device" : "/api/customer-inbox"}?offset=${current.nextOffset}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (tab === "device") setDevice((p) => merge(p, data));
      else setInbox((p) => (p ? { ...p, ...merge(p, data) } : data));
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to load more chats.",
      );
    } finally {
      setBusy(false);
    }
  }
  const current = tab === "email" && inbox ? inbox : device;
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <span className={styles.eyebrow}>BIRDSHOP / PRIVATE INBOX</span>
        <h1>Your conversations.</h1>
        <p className={styles.intro}>
          Pick up where you left off. Chats created on this device are saved
          here for 30 days.
        </p>
        {loading ? (
          <p role="status">Opening your conversations…</p>
        ) : (
          <>
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
              {(device.conversations.length > 0 || inbox) && (
                <button
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() => forget()}
                >
                  Sign out & forget this device
                </button>
              )}
            </div>
            <div className={styles.tabs} aria-label="Conversation lists">
              <button
                className={styles.secondary}
                aria-pressed={tab === "device"}
                disabled={busy}
                onClick={() => setTab("device")}
              >
                On this device
              </button>
              <button
                className={styles.secondary}
                aria-pressed={tab === "email"}
                disabled={busy || !inbox}
                onClick={() => setTab("email")}
              >
                Verified email chats
              </button>
            </div>
            <p className={styles.hint}>
              {tab === "email" && inbox
                ? `Linked to ${inbox.email}`
                : "These chats can be opened here without checking your email."}
            </p>
            {current.conversations.length === 0 ? (
              <div className={styles.notice}>
                <strong>
                  {tab === "email"
                    ? "No conversations linked yet."
                    : "Your next conversation starts here."}
                </strong>
                <p>
                  {tab === "email"
                    ? "Start a request using your verified email and it will appear here."
                    : "Start a new chat and it will be remembered on this device. For older chats, open a private link and choose Remember this chat, or verify your email below."}
                </p>
              </div>
            ) : (
              <div className={styles.list}>
                {current.conversations.map((c) => (
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
                          "BirdShop support"}
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
                    <div className={styles.cardActions}>
                      <button
                        className={styles.primary}
                        disabled={busy}
                        onClick={() => openChat(c.id)}
                      >
                        {c.conversation_status === "closed"
                          ? "View conversation"
                          : "Continue conversation"}{" "}
                        →
                      </button>
                      {tab === "device" && (
                        <button
                          className={styles.secondary}
                          disabled={busy}
                          onClick={() => forget(c.id)}
                          aria-label={`Forget ${c.reference} on this device`}
                        >
                          Forget on this device
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {current.nextOffset !== null && (
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={loadMore}
              >
                Load more conversations
              </button>
            )}
            {!inbox ? (
              <details
                className={styles.recovery}
                open={device.conversations.length === 0}
              >
                <summary>Find conversations from another device</summary>
                <p className={styles.hint}>
                  Verify your email once to see every conversation linked to it.
                  Saved chats above do not need this step.
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
                    {busy ? "Please wait…" : "Email my sign-in link"}
                  </button>
                </form>
                {notice && (
                  <div className={styles.notice} role="status">
                    <strong>Check your inbox</strong>
                    <p>{notice}</p>
                  </div>
                )}
              </details>
            ) : (
              <p className={styles.hint}>
                Email verified as {inbox.email}. Forgetting a device-saved chat
                does not remove it from your verified email inbox.
              </p>
            )}
          </>
        )}
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
