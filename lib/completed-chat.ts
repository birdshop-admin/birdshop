import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// A completed service chat stays open this long so the customer can say thanks
// or ask a last question. Then it closes; staff still see it under Completed.
export const CLOSE_AFTER_COMPLETION_MS = 60 * 60 * 1000;

const CLOSED_MESSAGE =
  "This order is complete and this chat is now closed. Need anything else? Start a new conversation from My Service.";

// When the chat for this completed order closes, or null if not completed.
export async function completionClosesAt(orderId: string): Promise<Date | null> {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select("fulfilled_at,service_status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error("Completed order could not be read.");
  if (!data?.fulfilled_at || data.service_status !== "completed") return null;
  return new Date(new Date(data.fulfilled_at).getTime() + CLOSE_AFTER_COMPLETION_MS);
}

// Closes an open chat once, with a short system message. Safe to call twice:
// only the call that actually closes it adds the message.
export async function closeCompletedChat(conversationId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("service_conversations")
    .update({ status: "closed" })
    .eq("id", conversationId)
    .eq("status", "open")
    .select("id");
  if (error || !data?.length) return false;
  await db.from("service_messages").insert({
    conversation_id: conversationId,
    sender_type: "system",
    sender_label: "BirdShop",
    body: CLOSED_MESSAGE,
    message_type: "system",
    metadata: { event: "chat_auto_closed" },
  });
  return true;
}
