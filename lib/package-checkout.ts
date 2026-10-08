import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenHash } from "@/lib/order-access";
import type { CheckoutAttempt } from "@/lib/payment-service";

export async function readPackageAttempt(token: string): Promise<CheckoutAttempt> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Unavailable");
  const { data, error } = await createAdminClient().from("birdshop_checkout_attempts")
    .select("*").eq("access_hash", tokenHash(token)).eq("kind", "package").single();
  if (error || !data) throw new Error("Unavailable");
  return data as CheckoutAttempt;
}

export async function paidServiceChat(orderId: string | null): Promise<string | null> {
  if (!orderId) return null;
  const db = createAdminClient();
  const { data: order, error } = await db.from("orders")
    .select("id,paid_at,order_type").eq("id", orderId).single();
  if (error || !order?.paid_at || order.order_type !== "service") throw new Error("Payment verification unavailable");
  const { data: chat, error: chatError } = await db.from("service_conversations")
    .select("public_token").eq("order_id", orderId)
    .is("deleted_at", null).is("purged_at", null).maybeSingle();
  if (chatError) throw new Error("Chat unavailable");
  return chat?.public_token ?? null;
}
