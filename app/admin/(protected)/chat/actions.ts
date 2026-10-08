"use server";
import { cancelQuote } from "@/lib/payment-service";
import { requireStaff as authenticatePaymentStaff } from "@/lib/staff-auth";
import { requireOwner } from "@/lib/staff-auth";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/server-config";

/* =========================================================
   TYPES
========================================================= */

export type SendAdminChatResult =
  | {
      ok: true;
    }
  | {
      ok: false;

      error: string;
    };

/* =========================================================
   ADMIN
========================================================= */

async function requireAdmin() {
  return (await requireOwner()).supabase;
}

/* =========================================================
   URL
========================================================= */

function chatUrl(
  view: string,
  conversationId?: string,
  message?: string,
  tone: "success" | "error" = "success",
) {
  const params = new URLSearchParams();

  params.set("view", view);

  if (conversationId) {
    params.set("conversation", conversationId);
  }

  if (message) {
    params.set("message", message);

    params.set("tone", tone);
  }

  return `/admin/chat?${params.toString()}`;
}

function returnChatUrl(formData: FormData, fallback: string, message: string, tone: "success" | "error" = "success") {
  const requested = String(formData.get("return_view") ?? fallback);
  const normalized = requested === "deleted" ? "closed" : requested;
  const view = ["new", "progress", "completed", "closed"].includes(normalized) ? normalized : fallback;
  const type = String(formData.get("return_type") ?? "all");
  const params = new URLSearchParams({ view, message, tone });
  if (["all", "service", "product", "general"].includes(type)) params.set("type", type);
  const page = Number(formData.get("return_page"));
  if (Number.isSafeInteger(page) && page > 1) params.set("page", String(page));
  return `/admin/chat?${params.toString()}`;
}

/* =========================================================
   REFRESH
========================================================= */

function refreshAdmin() {
  revalidatePath("/admin");

  revalidatePath("/admin/chat");

}

/* =========================================================
   SEND CHAT MESSAGE
========================================================= */

export async function sendAdminChatMessage(
  formData: FormData,
): Promise<SendAdminChatResult> {
  const supabase = await requireAdmin();

  const conversationId = String(formData.get("conversation_id") ?? "").trim();

  const body = String(formData.get("body") ?? "").trim();

  if (!conversationId) {
    return {
      ok: false,

      error: "Conversation ID is missing.",
    };
  }

  if (!body) {
    return {
      ok: false,

      error: "Enter a message before sending.",
    };
  }

  if (body.length > 4000) {
    return {
      ok: false,

      error: "Message is too long.",
    };
  }

  const { error } = await supabase.rpc("birdshop_v3_staff_send_message", {
    p_conversation_id: conversationId,

    p_body: body,
    p_request_id: String(formData.get("request_id") ?? ""),
  });

  if (error) {
    return {
      ok: false,

      error:
        "This action could not be completed. Refresh and retry. Financial history is protected.",
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   CREATE PAYMENT REQUEST
========================================================= */

export type PaymentActionResult =
  { ok: true; message: string } | { ok: false; error: string };

export async function createPaymentRequest(
  formData: FormData,
): Promise<PaymentActionResult> {
  const supabase = await requireAdmin();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!conversationId)
    return { ok: false, error: "Choose a conversation first." };
  if (!Number.isFinite(amount) || amount < 0.5 || amount > 999999.99)
    return { ok: false, error: "Enter an amount between 0.50 and 999,999.99." };
  if (!title || title.length > 180)
    return { ok: false, error: "Enter a title of up to 180 characters." };
  if (description.length > 2000)
    return { ok: false, error: "Keep the description under 2,000 characters." };

  try {
    const { error } = await supabase.rpc(
      "birdshop_admin_create_payment_request",
      {
        p_conversation_id: conversationId,
        p_amount: amount,
        p_title: title,
        p_description: description || null,
      },
    );
    if (error)
      return {
        ok: false,
        error:
          "Could not create the request. Check the current payment status before retrying.",
      };
  } catch {
    return {
      ok: false,
      error: "Unable to confirm the request. Check the chat before retrying.",
    };
  }
  // Merge fresh server data without navigating away from the conversation.
  refreshAdmin();
  return { ok: true, message: "Payment request sent." };
}

/* =========================================================
   CANCEL PAYMENT REQUEST

   IMPORTANT:

   1. Verify the BirdShop payment request.
   2. If Stripe Checkout exists, inspect it.
   3. If payment already completed, refuse cancellation.
   4. If Checkout is open, expire it.
   5. Only AFTER Stripe is safe do we cancel BirdShop.

   This prevents:

   BirdShop = cancelled
   Stripe   = still payable
========================================================= */

export async function cancelPaymentRequest(
  formData: FormData,
): Promise<PaymentActionResult> {
  const { user } = await authenticatePaymentStaff();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const requestId = String(formData.get("payment_request_id") ?? "").trim();
  if (!conversationId || !requestId)
    return { ok: false, error: "Choose a payment request first." };
  try {
    await cancelQuote(requestId, conversationId, user.id);
  } catch {
    return {
      ok: false,
      error:
        "Could not cancel this request. It may already be paid or inactive. Check its status before retrying.",
    };
  }
  revalidatePath("/admin/chat");
  return { ok: true, message: "Payment request cancelled." };
}

/* =========================================================
   OPEN / CLOSE
========================================================= */

export async function setConversationStatus(formData: FormData) {
  const supabase = await requireAdmin();

  const conversationId = String(formData.get("conversation_id") ?? "").trim();

  const status = String(formData.get("status") ?? "").trim();

  if (!conversationId || !["open", "closed"].includes(status)) {
    return;
  }

  const { error } = await supabase
    .from("service_conversations")
    .update({
      status,
    })
    .eq("id", conversationId)
    .is("deleted_at", null);

  if (error) {
    redirect(
      chatUrl(
        status === "open" ? "closed" : "active",

        conversationId,

        "This action could not be completed. Refresh and retry. Financial history is protected.",

        "error",
      ),
    );
  }

  refreshAdmin();

  redirect(
    chatUrl(
      status === "closed" ? "closed" : "active",

      conversationId,
    ),
  );
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteConversation(formData: FormData) {
  const supabase = await requireAdmin();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  if (!conversationId) return;
  const { error } = await supabase.rpc("birdshop_admin_delete_service_conversation", { p_conversation_id: conversationId });
  if (error) redirect(returnChatUrl(formData, "closed", "Could not move this conversation to Deleted. Refresh and retry.", "error"));
  refreshAdmin();
  redirect(returnChatUrl(formData, "closed", "Conversation retained in Closed."));
}

export async function restoreConversation(formData: FormData) {
  const supabase = await requireAdmin();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  if (!conversationId) return;
  const { error } = await supabase.rpc("birdshop_admin_restore_service_conversation", { p_conversation_id: conversationId });
  if (error) redirect(returnChatUrl(formData, "closed", "This conversation is unavailable or permanently removed.", "error"));
  refreshAdmin();
  redirect(returnChatUrl(formData, "closed", "Conversation restored to Closed."));
}

export async function permanentlyDeleteConversation(formData: FormData) {
  const supabase = await requireAdmin();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  if (!conversationId) return;
  const { error } = await supabase.rpc("birdshop_admin_permanently_delete_service_conversation", { p_conversation_id: conversationId });
  if (error) redirect(returnChatUrl(formData, "closed", "Could not remove this chat. Confirm the owner chat cleanup migration is installed, then retry.", "error"));
  refreshAdmin();
  redirect(returnChatUrl(formData, "closed", "Chat permanently removed. Linked payment records were retained."));
}

/* =========================================================
   COMPLETE SERVICE ORDER (from the chat)

   Owner, or the active service agent assigned to this chat.
   Runs the same database function as Admin → Orders, so the
   completion rules, the single completion email and the chat
   message are identical. The chat closes automatically one
   hour later (lib/maintenance.ts).
========================================================= */

export async function completeServiceOrderFromChat(formData: FormData) {
  const { user, profile } = await authenticatePaymentStaff();
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const back = (message: string, tone: "success" | "error" = "success", view = "progress") =>
    chatUrl(view, conversationId || undefined, message, tone);

  if (!isUuid(conversationId) || formData.get("confirm") !== "yes") {
    redirect(back("Tick the confirmation box to complete this order.", "error"));
  }

  const db = createAdminClient();
  const { data: chat, error: chatError } = await db
    .from("service_conversations")
    .select("id,order_id,conversation_type,assigned_staff_user_id,status,deleted_at")
    .eq("id", conversationId)
    .maybeSingle();

  if (chatError || !chat || chat.deleted_at || chat.conversation_type !== "service") {
    redirect(back("This conversation could not be found.", "error"));
  }

  const allowed =
    profile.role === "owner" ||
    (profile.role === "service_agent" && chat.assigned_staff_user_id === user.id);

  if (!allowed) redirect(back("Only the owner or the assigned provider can complete this order.", "error"));
  if (!chat.order_id) redirect(back("There is no paid order in this chat yet.", "error"));

  const { error } = await db.rpc("birdshop_set_service_order_status", {
    p_order_id: chat.order_id,
    p_status: "completed",
    p_assigned_to: null,
  });

  if (error) {
    const known = [
      "Completed orders cannot be reopened.",
      "Refunded orders cannot change status.",
      "Payment must be recorded before final delivery or completion.",
    ];
    redirect(back(known.includes(error.message) ? error.message : "The order could not be completed. Refresh and retry.", "error"));
  }

  // Send the completion email now instead of waiting for the schedule.
  after(async () => {
    const { drainEmailJobs } = await import("@/lib/email-jobs");
    await drainEmailJobs(2).catch(() => undefined);
  });

  refreshAdmin();
  redirect(back("Order completed. The customer has been emailed, and this chat closes automatically in 1 hour.", "success", "completed"));
}
