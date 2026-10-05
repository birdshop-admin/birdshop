"use server";
import { cancelQuote } from "@/lib/payment-service";
import { requireStaff as authenticatePaymentStaff } from "@/lib/staff-auth";
import { requireOwner } from "@/lib/staff-auth";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

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

/* =========================================================
   REFRESH
========================================================= */

function refreshAdmin() {
  revalidatePath("/admin");

  revalidatePath("/admin/chat");

  revalidatePath("/admin/orders");
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
  if (!Number.isFinite(amount) || amount < 0.5)
    return { ok: false, error: "Enter an amount of at least 0.50." };
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
  revalidatePath("/admin/orders");
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

  if (!conversationId) {
    return;
  }

  const { error } = await supabase.rpc(
    "birdshop_admin_delete_service_conversation",
    {
      p_conversation_id: conversationId,
    },
  );

  if (error) {
    redirect(
      chatUrl(
        "closed",
        conversationId,
        "This action could not be completed. Refresh and retry. Financial history is protected.",
        "error",
      ),
    );
  }

  refreshAdmin();

  redirect(chatUrl("deleted", undefined, "Conversation moved to Deleted."));
}

/* =========================================================
   RESTORE
========================================================= */

export async function restoreConversation(formData: FormData) {
  const supabase = await requireAdmin();

  const conversationId = String(formData.get("conversation_id") ?? "").trim();

  if (!conversationId) {
    return;
  }

  const { error } = await supabase.rpc(
    "birdshop_admin_restore_service_conversation",
    {
      p_conversation_id: conversationId,
    },
  );

  if (error) {
    redirect(
      chatUrl(
        "deleted",
        undefined,
        "This action could not be completed. Refresh and retry. Financial history is protected.",
        "error",
      ),
    );
  }

  refreshAdmin();

  redirect(chatUrl("closed", conversationId, "Conversation restored."));
}

/* =========================================================
   PERMANENT DELETE
========================================================= */

export async function permanentlyDeleteConversation(formData: FormData) {
  const supabase = await requireAdmin();

  const conversationId = String(formData.get("conversation_id") ?? "").trim();

  if (!conversationId) {
    return;
  }

  const { error } = await supabase.rpc(
    "birdshop_admin_permanently_delete_service_conversation",
    {
      p_conversation_id: conversationId,
    },
  );

  if (error) {
    redirect(
      chatUrl(
        "deleted",
        undefined,
        "This action could not be completed. Refresh and retry. Financial history is protected.",
        "error",
      ),
    );
  }

  refreshAdmin();

  redirect(chatUrl("deleted", undefined, "Conversation permanently deleted."));
}
