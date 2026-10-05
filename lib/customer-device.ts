import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inboxCookieOptions,
  inboxTokenHash,
  newInboxToken,
  validInboxToken,
} from "@/lib/customer-inbox";
export const DEVICE_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-birdshop-device"
    : "birdshop-device";
export async function readCustomerDevice() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!validInboxToken(token)) return null;
  const hash = inboxTokenHash(token);
  const { data, error } = await createAdminClient()
    .from("birdshop_customer_devices")
    .select("token_hash")
    .eq("token_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error("Device access unavailable");
  return data ? { token, hash } : null;
}
export async function rememberDeviceChat(chatToken: string) {
  const existing = await readCustomerDevice();
  // Never adopt an arbitrary unknown cookie supplied by a browser.
  const token = existing?.token ?? newInboxToken();
  const db = createAdminClient();
  const { data, error } = await db.rpc("birdshop_remember_device_chat", {
    p_device_hash: inboxTokenHash(token),
    p_chat_token: chatToken,
  });
  if (error) throw new Error("Unable to remember chat");
  if (data !== true) return false;
  (await cookies()).set(DEVICE_COOKIE, token, {
    ...inboxCookieOptions,
    maxAge: 30 * 86400,
  });
  return true;
}
export async function forgetCustomerDevice() {
  const jar = await cookies(),
    token = jar.get(DEVICE_COOKIE)?.value;
  if (validInboxToken(token)) {
    const { error } = await createAdminClient()
      .from("birdshop_customer_devices")
      .delete()
      .eq("token_hash", inboxTokenHash(token));
    if (error) throw new Error("Unable to forget device");
  }
  jar.set(DEVICE_COOKIE, "", { ...inboxCookieOptions, maxAge: 0 });
}
