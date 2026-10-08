"use client";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowIcon,
  CartIcon,
  CheckIcon,
  MessageIcon,
  ShieldIcon,
} from "@/components/SiteIcons";
import { clearServiceChatToken } from "@/lib/service-chat-session";
import {
  CloseIcon,
  MailIcon,
  RefreshIcon,
  Spinner,
  StatusChip,
} from "./ChatUI";
import ui from "./chat-ui.module.css";
import { formatListDate, statusView, typeLabel, useNow } from "./presentation";
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
  // Optional: only present once the inbox list functions return them.
  workflow_status?: string | null;
  service_status?: string | null;
  payment_status?: string | null;
  last_message_at?: string | null;
  last_sender_type?: string | null;
  has_unread?: boolean | null;
  pending_payment_amount?: number | string | null;
  pending_payment_currency?: string | null;
};
type List = { conversations: Conversation[]; nextOffset: number | null };
type Inbox = List & { email: string };
type Source = "device" | "email";
// A proxy error page can arrive as 200 with a non-JSON body; only real lists are used.
const isList = <T extends List = List>(value: unknown): value is T =>
  Boolean(value) &&
  Array.isArray((value as Partial<List>).conversations);
const emptyList: List = { conversations: [], nextOffset: null };
const TABS: Source[] = ["device", "email"];
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
  const now = useNow();
  const [device, setDevice] = useState<List>(emptyList),
    [inbox, setInbox] = useState<Inbox | null>(null),
    [tab, setTab] = useState<Source>("device");
  const [email, setEmail] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [openingId, setOpeningId] = useState<string | null>(null),
    [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      fetch("/api/customer-device", { cache: "no-store", signal }).then(
        async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." })) }),
      ),
      fetch("/api/customer-inbox", { cache: "no-store", signal }).then(
        async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." })) }),
      ),
    ]);
    if (signal?.aborted) return;
    const [d, e] = results;
    const problems: string[] = [];
    let deviceCount = 0;
    if (d.status === "fulfilled" && d.value.ok && isList(d.value.data)) {
      setDevice(d.value.data);
      deviceCount = d.value.data.conversations.length;
    } else {
      setDevice(emptyList);
      problems.push(
        "Saved chats could not be loaded. Try refreshing your inbox.",
      );
    }
    if (e.status === "fulfilled" && e.value.ok && isList<Inbox>(e.value.data)) {
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
      const data = await response.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." }));
      if (!response.ok) throw new Error(data.error || "Please retry in a moment.");
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
    setOpeningId(id);
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
      const data = await response.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." }));
      if (!response.ok) throw new Error(data.error || "Please retry in a moment.");
      router.push(data.url);
    } catch (problem) {
      setOpeningId(null);
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
      const data = await response.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." }));
      if (!response.ok) throw new Error(data.error || "Please retry in a moment.");
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
      const data = await response.json().catch(() => ({ error: "BirdShop is temporarily unavailable. Please retry in a moment." }));
      if (!response.ok || !isList<Inbox>(data))
        throw new Error(data.error || "Please retry in a moment.");
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
  async function refresh() {
    setBusy(true);
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
      setBusy(false);
    }
  }
  // Tabs stay focusable while busy (no disabled attribute), so the guard lives here.
  function selectTab(next: Source) {
    if (!busy) setTab(next);
  }
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.indexOf(tab);
    const next =
      event.key === "ArrowRight"
        ? TABS[(index + 1) % TABS.length]
        : event.key === "ArrowLeft"
          ? TABS[(index - 1 + TABS.length) % TABS.length]
          : event.key === "Home"
            ? TABS[0]
            : event.key === "End"
              ? TABS[TABS.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    if (busy) return;
    setTab(next);
    document.getElementById(`inbox-tab-${next}`)?.focus();
  }
  function findOlderChats() {
    selectTab("email");
    document.getElementById("inbox-tab-email")?.focus();
  }
  const current = tab === "email" && inbox ? inbox : device;
  const showVerify = tab === "email" && !inbox;
  const deviceCount = `${device.conversations.length}${device.nextOffset !== null ? "+" : ""}`;
  const emailCount = inbox
    ? `${inbox.conversations.length}${inbox.nextOffset !== null ? "+" : ""}`
    : "";
  const errorBanner = error ? (
    <div className={styles.error} role="alert">
      <span>{error}</span>
      <button
        type="button"
        className={styles.textButton}
        disabled={busy || loading}
        onClick={() => void refresh()}
      >
        Try Again
      </button>
    </div>
  ) : null;
  return (
    <section className={`${ui.tokens} ${styles.page}`}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <span className={styles.eyebrow}>My Service · Private inbox</span>
            <h1 className={styles.title}>Your conversations.</h1>
            <p className={styles.intro}>
              Pick up where you left off. Chats you start on this device stay
              here for 30 days.
            </p>
          </div>
          <div className={styles.heroActions}>
            <Link className={styles.primary} href="/contact">
              Start a Conversation
              <ArrowIcon />
            </Link>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Refresh inbox"
              disabled={busy || loading}
              onClick={() => void refresh()}
            >
              <RefreshIcon data-spinning={refreshing} />
              <span className={styles.iconLabel} aria-hidden="true">
                Refresh
              </span>
            </button>
          </div>
        </header>
        {!showVerify && errorBanner}
        {loading ? (
          <div className={styles.loading} role="status">
            <span className="visually-hidden">Opening your conversations…</span>
            <div className={styles.skeletonTabs} aria-hidden="true" />
            <div className={styles.skeletonRow} aria-hidden="true" />
            <div className={styles.skeletonRow} aria-hidden="true" />
            <div className={styles.skeletonRow} aria-hidden="true" />
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Conversation lists"
              className={styles.tabs}
            >
              <button
                type="button"
                role="tab"
                id="inbox-tab-device"
                className={styles.tab}
                aria-selected={tab === "device"}
                aria-controls="inbox-panel"
                tabIndex={tab === "device" ? 0 : -1}
                onClick={() => selectTab("device")}
                onKeyDown={handleTabKeyDown}
              >
                On this device
                <span className={styles.count}>{deviceCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="inbox-tab-email"
                className={styles.tab}
                aria-selected={tab === "email"}
                aria-controls="inbox-panel"
                tabIndex={tab === "email" ? 0 : -1}
                onClick={() => selectTab("email")}
                onKeyDown={handleTabKeyDown}
              >
                Verified email
                {inbox ? (
                  <span className={styles.count}>{emailCount}</span>
                ) : (
                  <span className={styles.countMuted}>Verify</span>
                )}
              </button>
            </div>
            <div
              id="inbox-panel"
              role="tabpanel"
              aria-labelledby={`inbox-tab-${tab}`}
              className={styles.panel}
            >
              {tab === "device" ? (
                <p className={styles.panelHint}>
                  Opens instantly on this device. No email needed.
                </p>
              ) : inbox ? (
                <p className={styles.panelHint}>
                  Linked to <strong>{inbox.email}</strong>
                </p>
              ) : null}
              {showVerify ? (
                <div className={styles.verify}>
                  <span className={styles.verifyIcon} aria-hidden="true">
                    <MailIcon />
                  </span>
                  <h2 className={styles.panelTitle}>
                    Find conversations from another device
                  </h2>
                  <ol className={styles.steps}>
                    <li>
                      <span aria-hidden="true">1</span>Enter your email
                    </li>
                    <li>
                      <span aria-hidden="true">2</span>Open the link we send
                    </li>
                    <li>
                      <span aria-hidden="true">3</span>See every conversation
                    </li>
                  </ol>
                  {errorBanner}
                  <form className={styles.form} onSubmit={requestLink}>
                    <label htmlFor="inbox-email">Email address</label>
                    <div className={styles.inputRow}>
                      <input
                        id="inbox-email"
                        type="email"
                        autoComplete="email"
                        maxLength={320}
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        aria-describedby="inbox-email-hint"
                      />
                      <button className={styles.primary} disabled={busy}>
                        {busy ? "Sending…" : "Email My Sign-In Link"}
                      </button>
                    </div>
                    <p id="inbox-email-hint" className={styles.hint}>
                      Chats saved on this device don&apos;t need this step.
                    </p>
                  </form>
                  {notice && (
                    <div className={styles.success} role="status">
                      <CheckIcon />
                      <div>
                        <strong>Check your inbox</strong>
                        <p>{notice}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : current.conversations.length === 0 ? (
                <div className={styles.empty}>
                  <span className={styles.emptyMark} aria-hidden="true">
                    <MessageIcon />
                  </span>
                  <h2>
                    {tab === "email"
                      ? "No conversations linked yet."
                      : "Your next conversation starts here."}
                  </h2>
                  <p>
                    {tab === "email" && inbox
                      ? `Requests made with ${inbox.email} will appear here.`
                      : inbox
                        ? "Start a chat and it will be remembered on this device. Chats linked to your email are under Verified email."
                        : "Start a chat and it will be remembered on this device. Have older chats? Find them with your email."}
                  </p>
                  <div className={styles.emptyActions}>
                    <Link className={styles.primary} href="/contact">
                      Start a Conversation
                      <ArrowIcon />
                    </Link>
                    {tab === "device" && !inbox && (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={findOlderChats}
                      >
                        Find My Older Chats
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <ul className={styles.list}>
                  {current.conversations.map((c) => {
                    const st = statusView(c);
                    const closed = c.conversation_status === "closed";
                    const when = c.last_message_at
                      ? formatListDate(c.last_message_at, now)
                      : formatListDate(c.created_at, now);
                    return (
                      <li
                        key={c.id}
                        className={styles.row}
                        data-tone={st.tone}
                        data-unread={c.has_unread || undefined}
                      >
                        <button
                          type="button"
                          className={styles.rowMain}
                          disabled={busy}
                          onClick={() => openChat(c.id)}
                          title={st.description}
                        >
                          <span
                            className={styles.rowIcon}
                            data-type={c.conversation_type}
                            aria-hidden="true"
                          >
                            {c.conversation_type === "service" ? (
                              <ShieldIcon />
                            ) : c.conversation_type === "product" ? (
                              <CartIcon />
                            ) : (
                              <MessageIcon />
                            )}
                          </span>
                          <span className={styles.rowBody}>
                            <span className={styles.rowMeta}>
                              <span className={styles.ref}>{c.reference}</span>
                              {" · "}
                              {typeLabel(c.conversation_type)}
                            </span>
                            <span className={styles.rowTitle}>
                              {c.subject ||
                                c.service_name ||
                                c.product_name ||
                                "BirdShop support"}
                            </span>
                            {when && (
                              <span className={styles.rowSub}>
                                {c.last_message_at ? "Updated" : "Started"}{" "}
                                {when}
                              </span>
                            )}
                          </span>
                          <span className={styles.rowSide}>
                            <StatusChip
                              className={styles.rowChip}
                              tone={st.tone}
                              label={st.label}
                            />
                            <span className={styles.rowCta}>
                              {closed ? "View" : "Continue"}
                              {openingId === c.id ? <Spinner /> : <ArrowIcon />}
                            </span>
                          </span>
                          {c.has_unread && (
                            <span className="visually-hidden">New reply.</span>
                          )}
                        </button>
                        {tab === "device" && (
                          <button
                            type="button"
                            className={styles.rowForget}
                            disabled={busy}
                            onClick={() => forget(c.id)}
                            aria-label={`Forget ${c.reference} on this device`}
                            title="Forget on this device"
                          >
                            <CloseIcon />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {!showVerify && current.nextOffset !== null && (
                <button
                  type="button"
                  className={`${styles.secondary} ${styles.loadMore}`}
                  disabled={busy}
                  onClick={loadMore}
                >
                  Show More Conversations
                </button>
              )}
            </div>
            <footer className={styles.footer}>
              <p className={styles.hint}>
                {inbox
                  ? `Email verified as ${inbox.email}. Forgetting a device-saved chat does not remove it from your verified inbox.`
                  : "Shared computer? Sign out when you're done."}
              </p>
              {(device.conversations.length > 0 || inbox) && (
                <button
                  type="button"
                  className={styles.dangerText}
                  disabled={busy}
                  onClick={() => forget()}
                >
                  Sign Out &amp; Forget This Device
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </section>
  );
}
