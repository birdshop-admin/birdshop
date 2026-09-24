/* =========================================================
   BIRDSHOP PRIVATE SERVICE CHAT SESSION

   This file remembers which private service conversation
   belongs to the customer while they browse BirdShop.

   The service token is stored in sessionStorage rather than
   localStorage because it grants access to a private chat.
========================================================= */

export const SERVICE_CHAT_TOKEN_STORAGE_KEY =
  "birdshop-active-service-chat-token";

export const SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY =
  "birdshop-service-chat-last-incoming";

export const SERVICE_CHAT_TOKEN_EVENT =
  "birdshop:service-chat-token";

export const SERVICE_CHAT_LIVE_EVENT =
  "birdshop:service-chat-live";

export const SERVICE_CHAT_BROADCAST_EVENT =
  "admin-message";

/* =========================================================
   REALTIME CHANNEL

   Every private conversation gets its own channel based on
   its long random public token.

   We will NOT broadcast the customer's messages or private
   chat contents through this channel.

   It only tells the browser:
   "Your private chat changed — securely fetch it now."
========================================================= */

export function serviceChatChannelName(
  token: string
) {
  return `birdshop-service-chat-${token}`;
}

/* =========================================================
   SAVE PRIVATE CHAT TOKEN
========================================================= */

export function saveServiceChatToken(
  token: string
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const clean =
    token.trim();

  if (!clean) {
    return;
  }

  const existing =
    window.sessionStorage.getItem(
      SERVICE_CHAT_TOKEN_STORAGE_KEY
    );

  /*
   * If this browser tab moves to a different conversation,
   * clear the old incoming-message marker.
   */

  if (
    existing &&
    existing !== clean
  ) {
    window.sessionStorage.removeItem(
      SERVICE_CHAT_LAST_INCOMING_STORAGE_KEY
    );
  }

  window.sessionStorage.setItem(
    SERVICE_CHAT_TOKEN_STORAGE_KEY,
    clean
  );

  /*
   * Tell global BirdShop components that a private service
   * chat is now available in this browser tab.
   */

  window.dispatchEvent(
    new CustomEvent(
      SERVICE_CHAT_TOKEN_EVENT,
      {
        detail:
          clean,
      }
    )
  );
}

/* =========================================================
   READ PRIVATE CHAT TOKEN
========================================================= */

export function readServiceChatToken() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return (
    window.sessionStorage.getItem(
      SERVICE_CHAT_TOKEN_STORAGE_KEY
    ) ??
    null
  );
}