"use server";
import type { PaymentActionResult } from "./actions";
import { cancelQuote } from "@/lib/payment-service";
import { requireStaff as authenticateStaff } from "@/lib/staff-auth";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

/* =========================================================
   TYPES
========================================================= */

export type SendServiceAgentMessageResult =
  | {
      ok: true;
    }
  | {
      ok: false;

      error: string;
    };

/* =========================================================
   STAFF AUTH
========================================================= */

async function requireStaff() {
  return authenticateStaff();
}

/* =========================================================
   URL
========================================================= */

function serviceChatUrl(conversationId?: string) {
  const params = new URLSearchParams();

  params.set("view", "active");

  params.set("type", "service");

  if (conversationId) {
    params.set("conversation", conversationId);
  }

  return `/admin/chat?${params.toString()}`;
}

/* =========================================================
   REFRESH
========================================================= */

function refreshChat() {
  revalidatePath("/admin/chat");

  revalidatePath("/admin/orders");

  revalidatePath("/admin");
}

/* =========================================================
   ACCEPT SERVICE
========================================================= */

export async function acceptServiceConversation(formData: FormData) {
  const { supabase } = await requireStaff();

  const conversationId = String(formData.get("conversation_id") ?? "").trim();

  if (!conversationId) {
    redirect(serviceChatUrl());
  }

  const { error } = await supabase.rpc(
    "birdshop_staff_accept_service_conversation",
    {
      p_conversation_id: conversationId,
    },
  );

  if (error) {
    throw new Error("This action could not be completed. Refresh and retry.");
  }

  refreshChat();

  redirect(serviceChatUrl(conversationId));
}

/* =========================================================
   LEAVE SERVICE
========================================================= */

export async function leaveServiceConversation(formData: FormData) {
  const { supabase } = await requireStaff();

  const conversationId = String(formData.get("conversation_id") ?? "").trim();

  if (!conversationId) {
    redirect(serviceChatUrl());
  }

  const { error } = await supabase.rpc(
    "birdshop_staff_leave_service_conversation",
    {
      p_conversation_id: conversationId,
    },
  );

  if (error) {
    throw new Error("This action could not be completed. Refresh and retry.");
  }

  refreshChat();

  redirect(serviceChatUrl());
}

/* =========================================================
   SEND MESSAGE
========================================================= */

export async function sendServiceAgentMessage(
  formData: FormData,
): Promise<SendServiceAgentMessageResult> {
  const { supabase } = await requireStaff();

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

      error: "This action could not be completed. Refresh and retry.",
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   CREATE PAYMENT REQUEST
========================================================= */

export async function createServiceAgentPaymentRequest(
  formData: FormData,
): Promise<PaymentActionResult> {
  const { supabase } = await requireStaff();
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
      "birdshop_staff_create_payment_request",
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
  refreshChat();
  return { ok: true, message: "Payment request sent." };
}

/* =========================================================
   CANCEL PAYMENT REQUEST

   IMPORTANT:

   Stripe Checkout is inspected FIRST.

   If Checkout is still open:
   → expire Stripe

   Only then:
   → cancel BirdShop payment request

   This preserves the cancellation protection already used
   by the Owner payment system.
========================================================= */

export async function cancelServiceAgentPaymentRequest(
  formData: FormData,
): Promise<PaymentActionResult> {
  const { user } = await authenticateStaff();
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
