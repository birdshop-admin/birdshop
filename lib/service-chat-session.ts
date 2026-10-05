/** Session-only bearer token for the customer's current private conversation. */
export const SERVICE_CHAT_TOKEN_STORAGE_KEY =
  "birdshop-active-service-chat-token";
export const SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY =
  "birdshop-service-chat-last-incoming";
export const SERVICE_CHAT_TOKEN_EVENT = "birdshop:service-chat-token";
export const SERVICE_CHAT_LIVE_EVENT = "birdshop:service-chat-live";
export const SERVICE_CHAT_BROADCAST_EVENT = "admin-message";
let memoryToken: string | null = null;

export function serviceChatChannelName(token: string) {
  return `birdshop-service-chat-${token}`;
}

export function readServiceChatToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.sessionStorage.getItem(SERVICE_CHAT_TOKEN_STORAGE_KEY) ||
      memoryToken
    );
  } catch {
    return memoryToken;
  }
}

export function saveServiceChatToken(token: string) {
  if (typeof window === "undefined") return;
  const clean = token.trim();
  if (!clean) return;
  const previous = readServiceChatToken();
  memoryToken = clean;
  try {
    if (previous !== clean)
      window.sessionStorage.removeItem(SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY);
    window.sessionStorage.setItem(SERVICE_CHAT_TOKEN_STORAGE_KEY, clean);
  } catch {
    // In-memory fallback still enables live updates in this page session.
  }
  if (previous !== clean) {
    window.dispatchEvent(
      new CustomEvent(SERVICE_CHAT_TOKEN_EVENT, { detail: clean }),
    );
  }
}

/** Forgets this tab's current-chat notifier; existing private links remain valid. */
export function clearServiceChatToken() {
  if (typeof window === "undefined") return;
  memoryToken = null;
  try {
    window.sessionStorage.removeItem(SERVICE_CHAT_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY);
  } catch {
    /* Storage can be unavailable in restricted browsers. */
  }
  window.dispatchEvent(
    new CustomEvent(SERVICE_CHAT_TOKEN_EVENT, { detail: null }),
  );
}
