export type SupportChatTopic =
  | "service"
  | "product"
  | "general";

export type BirdShopSupportChatContext = {
  topic: SupportChatTopic;
  label: string;
  reference?: string;
  productSlug?: string;
  productName?: string;
  serviceSlug?: string;
  serviceName?: string;
  packageId?: string;
  packageName?: string;
  subject?: string;
};

export const SUPPORT_CHAT_STORAGE_KEY =
  "birdshop-support-chat-context";

export const SUPPORT_CHAT_EVENT =
  "birdshop:support-context";

export function publishSupportChatContext(
  context: BirdShopSupportChatContext
) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    SUPPORT_CHAT_STORAGE_KEY,
    JSON.stringify(context)
  );

  window.dispatchEvent(
    new CustomEvent<BirdShopSupportChatContext>(
      SUPPORT_CHAT_EVENT,
      {
        detail: context,
      }
    )
  );
}

export function readSupportChatContext():
  | BirdShopSupportChatContext
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value =
      window.sessionStorage.getItem(
        SUPPORT_CHAT_STORAGE_KEY
      );

    return value
      ? (JSON.parse(value) as BirdShopSupportChatContext)
      : null;
  } catch {
    return null;
  }
}
