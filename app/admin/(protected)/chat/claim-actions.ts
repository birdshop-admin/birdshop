"use server";
import { requireStaff } from "@/lib/staff-auth";
import { isUuid } from "@/lib/server-config";
export type ClaimConversationResult =
  { ok: true; claimed: boolean } | { ok: false; error: string };
export async function claimConversationForCurrentStaff(
  conversationId: string,
): Promise<ClaimConversationResult> {
  const { supabase } = await requireStaff();
  if (!isUuid(conversationId))
    return { ok: false, error: "Conversation unavailable." };
  const { data: conversation, error: readError } = await supabase
    .from("service_conversations")
    .select("id,conversation_type,status,deleted_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (readError || !conversation)
    return { ok: false, error: "Conversation unavailable." };
  if (
    conversation.conversation_type !== "service" ||
    conversation.status !== "open" ||
    conversation.deleted_at
  )
    return { ok: true, claimed: false };
  const { data, error } = await supabase.rpc(
    "birdshop_staff_accept_service_conversation",
    { p_conversation_id: conversationId },
  );
  if (error)
    return {
      ok: false,
      error:
        "This service is unavailable or already assigned to another provider.",
    };
  return {
    ok: true,
    claimed: (data as { claimed?: boolean } | null)?.claimed === true,
  };
}
