import { useSyncExternalStore } from "react";
import { paymentLabel } from "@/lib/payment-display";

/* =========================================================
   MY SERVICE: PRESENTATION HELPERS

   Pure display logic only. Nothing here fetches, writes or
   decides whether a payment can start.
========================================================= */

export type Tone = "action" | "payment" | "progress" | "waiting" | "done";

export type StatusView = { label: string; tone: Tone; description: string };

export type StatusInput = {
  conversation_status: string;
  // Undefined means the row comes from the inbox list, which only knows open/closed.
  workflow_status?: string | null;
  service_status?: string | null;
  payment_status?: string | null;
  last_sender_type?: string | null;
  pending_payment_amount?: number | string | null;
  // Precomputed work stage (ServiceChatClient passes customerStatus()).
  stage?: string | null;
};

const PAID = new Set(["paid", "partially_refunded"]);
const WORKING = new Set(["paid", "assigned", "in_progress", "customer_replied"]);
const PAYMENT_STAGES = new Set(["payment_pending", "awaiting_payment"]);
const REPLY_STAGES = new Set(["waiting_customer", "quote_sent"]);

const DESCRIPTION: Record<Tone, string> = {
  action: "BirdShop replied. Your turn.",
  payment: "A secure payment request is waiting.",
  progress: "BirdShop is working on this.",
  waiting: "BirdShop has your latest message.",
  done: "This conversation is finished.",
};

function view(label: string, tone: Tone, description = DESCRIPTION[tone]) {
  return { label, tone, description };
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

// Mirrors customerStatus(): order work status wins once it moves past "new".
function stageOf(r: StatusInput) {
  if (r.stage !== undefined) return normalize(r.stage);
  const service = normalize(r.service_status);
  return service && service !== "new" ? service : normalize(r.workflow_status);
}

export function statusView(r: StatusInput): StatusView {
  const s = stageOf(r);
  const payment = normalize(r.payment_status);

  if (r.conversation_status === "closed")
    return s === "completed"
      ? view("Completed", "done")
      : view("Closed", "done", "This conversation is closed.");
  if (s === "completed") return view("Completed", "done");
  if (s === "cancelled") return view("Cancelled", "done");
  if (payment === "refunded")
    return view("Refunded", "done", "This payment was refunded.");
  if (r.pending_payment_amount != null || PAYMENT_STAGES.has(s))
    return view("Payment requested", "payment");
  if (
    REPLY_STAGES.has(s) ||
    (r.last_sender_type === "admin" && !WORKING.has(s))
  )
    return view("Awaiting your reply", "action");
  if (s === "ready_for_delivery") return view("Ready for delivery", "progress");
  if (WORKING.has(s) || PAID.has(payment))
    return view("In progress", "progress");
  if (r.workflow_status === undefined && r.stage === undefined)
    return view("Open", "waiting", "This conversation is open.");
  return view("With BirdShop", "waiting");
}

type StatusMessage = { sender_type: string };

type ChatStatusSource = {
  conversation_status: string;
  workflow_status: string | null;
  payment_status: string | null;
  messages: StatusMessage[];
};

export function chatStatus(
  chat: ChatStatusSource,
  options: {
    stage: string | null;
    pendingAmount: number | string | null;
    awaitingConfirmation: boolean;
    historyMode: boolean;
  },
): StatusView {
  if (options.awaitingConfirmation)
    return view(
      "Confirming payment",
      "payment",
      "BirdShop is confirming your payment.",
    );

  let lastSender: string | null = null;
  if (!options.historyMode) {
    for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
      if (chat.messages[i].sender_type !== "system") {
        lastSender = chat.messages[i].sender_type;
        break;
      }
    }
  }

  return statusView({
    conversation_status: chat.conversation_status,
    workflow_status: chat.workflow_status ?? null,
    payment_status: chat.payment_status,
    stage: options.stage ?? "",
    last_sender_type: lastSender,
    pending_payment_amount: PAID.has(normalize(chat.payment_status))
      ? null
      : options.pendingAmount,
  });
}

export type StepState = "done" | "current" | "upcoming";

export type ServiceStep = { label: string; state: StepState };

export function serviceSteps(
  chat: {
    conversation_type: string;
    conversation_status: string;
    payment_status: string | null;
    order_id: string | null;
  },
  stage: string | null,
  hasPendingPayment: boolean,
): ServiceStep[] | null {
  if (chat.conversation_type !== "service") return null;
  const s = normalize(stage);
  const payment = normalize(chat.payment_status);
  if (s === "cancelled" || s === "refunded" || payment === "refunded")
    return null;

  const paid = PAID.has(payment) || Boolean(chat.order_id);
  const closed = chat.conversation_status === "closed";
  // A closed, never-paid request has nothing left to track.
  if (closed && !paid) return null;

  const pending = hasPendingPayment && !paid;
  const done = s === "completed" || (closed && paid);
  const delivering = !done && s === "ready_for_delivery";

  return [
    {
      label: "Discuss your request",
      state: paid || pending ? "done" : "current",
    },
    {
      label: "Secure payment",
      state: paid ? "done" : pending ? "current" : "upcoming",
    },
    {
      label: "Work in progress",
      state: done || delivering ? "done" : paid ? "current" : "upcoming",
    },
    {
      label: "Delivered",
      state: done ? "done" : delivering ? "current" : "upcoming",
    },
  ];
}

/* =========================================================
   FORMATTERS (cached; one instance per format)
========================================================= */

const clockFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const shortFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const shortYearFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const dayYearFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long" });

function toDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function relativeDay(date: Date, now: number) {
  if (!now) return null;
  const today = new Date(now);
  if (dayKey(date) === dayKey(today)) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "yesterday";
  return null;
}

// "3:42 PM"
export function formatClock(iso: string) {
  const date = toDate(iso);
  return date ? clockFormat.format(date) : "";
}

// "Oct 6" this year, "Oct 6, 2025" otherwise (always with the year before the clock is known).
export function formatShortDate(iso: string, now = 0) {
  const date = toDate(iso);
  if (!date) return "";
  return now && new Date(now).getFullYear() === date.getFullYear()
    ? shortFormat.format(date)
    : shortYearFormat.format(date);
}

// Day divider: "Today" / "Yesterday" / "Monday, October 6" / "October 6, 2025".
export function formatDay(iso: string, now: number) {
  const date = toDate(iso);
  if (!date) return "";
  const relative = relativeDay(date, now);
  if (relative === "today") return "Today";
  if (relative === "yesterday") return "Yesterday";
  return now && new Date(now).getFullYear() === date.getFullYear()
    ? dayFormat.format(date)
    : dayYearFormat.format(date);
}

// Inbox rows, read after "Started" / "Updated": "3:42 PM", "yesterday", "Monday", "Oct 6".
export function formatListDate(iso: string, now: number) {
  const date = toDate(iso);
  if (!date) return "";
  const relative = relativeDay(date, now);
  if (relative === "today") return clockFormat.format(date);
  if (relative === "yesterday") return "yesterday";
  if (now && now - date.getTime() < 7 * 86_400_000 && date.getTime() <= now)
    return weekdayFormat.format(date);
  return formatShortDate(iso, now);
}

/* =========================================================
   MESSAGE GROUPING
========================================================= */

type Groupable = {
  id: string;
  sender_type: string;
  sender_label: string | null;
  message_type: string;
  created_at: string;
};

export type GroupedMessage<T> = {
  item: T;
  first: boolean;
  last: boolean;
  newDay: boolean;
};

const GROUP_WINDOW = 5 * 60_000;

function standsAlone(message: Groupable) {
  return (
    message.sender_type === "system" ||
    message.message_type === "system" ||
    message.message_type === "payment_request"
  );
}

export function groupMessages<T extends Groupable>(
  messages: readonly T[],
): GroupedMessage<T>[] {
  const days = messages.map((message) => {
    const date = toDate(message.created_at);
    return date ? dayKey(date) : "";
  });
  const joined = messages.map((message, index) => {
    if (index === 0) return false;
    const previous = messages[index - 1];
    if (standsAlone(message) || standsAlone(previous)) return false;
    if (days[index] !== days[index - 1]) return false;
    if (message.sender_type !== previous.sender_type) return false;
    if ((message.sender_label ?? "") !== (previous.sender_label ?? ""))
      return false;
    const gap =
      new Date(message.created_at).getTime() -
      new Date(previous.created_at).getTime();
    return gap >= 0 && gap <= GROUP_WINDOW;
  });

  return messages.map((item, index) => ({
    item,
    first: !joined[index],
    last: !joined[index + 1],
    newDay: days[index] !== "" && (index === 0 || days[index] !== days[index - 1]),
  }));
}

/* =========================================================
   CLOCK

   One shared minute clock through useSyncExternalStore, so no
   component reads Date.now() during render. The server snapshot
   is 0, which every formatter treats as "use absolute dates".
========================================================= */

let clockNow = 0;
let clockTimer: number | undefined;
const clockListeners = new Set<() => void>();

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    if (Date.now() - clockNow > 30_000) clockNow = Date.now();
    clockTimer = window.setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((notify) => notify());
    }, 60_000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

function readClock() {
  if (!clockNow) clockNow = Date.now();
  return clockNow;
}

function readServerClock() {
  return 0;
}

export function useNow() {
  return useSyncExternalStore(subscribeClock, readClock, readServerClock);
}

/* =========================================================
   LABELS (sentence case; CSS uppercases eyebrows and chips)
========================================================= */

export function typeLabel(type: string) {
  switch (type) {
    case "product":
      return "Product support";
    case "general":
      return "General support";
    default:
      return "Service";
  }
}

export function requestChipLabel(
  request: Parameters<typeof paymentLabel>[0],
  awaitingConfirmation: boolean,
) {
  if (request.status === "pending")
    return awaitingConfirmation ? "Confirming" : "Awaiting payment";
  return paymentLabel(request);
}
