"use server";
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

export async function createServiceAgentPaymentRequest(formData: FormData) {
  const { supabase } = await requireStaff();

  const conversationId = String(formData.get("conversation_id") ?? "").trim();

  const amount = Number(formData.get("amount") ?? 0);

  const title = String(formData.get("title") ?? "").trim();

  const description = String(formData.get("description") ?? "").trim();

  if (!conversationId) {
    redirect(serviceChatUrl());
  }

  if (!Number.isFinite(amount) || amount < 0.5) {
    throw new Error("Enter a valid payment amount.");
  }

  if (!title) {
    throw new Error("Enter a payment title.");
  }

  const { error } = await supabase.rpc(
    "birdshop_staff_create_payment_request",
    {
      p_conversation_id: conversationId,

      p_amount: amount,

      p_title: title,

      p_description: description || null,
    },
  );

  if (error) {
    throw new Error("This action could not be completed. Refresh and retry.");
  }

  refreshChat();

  redirect(serviceChatUrl(conversationId));
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

export async function cancelServiceAgentPaymentRequest(formData: FormData) {
  const { user } = await authenticateStaff();
  const conversationId = String(formData.get("conversation_id") ?? "");
  const requestId = String(formData.get("payment_request_id") ?? "");
  if (!conversationId || !requestId)
    throw new Error("Choose a payment request.");
  await cancelQuote(requestId, conversationId, user.id);
  revalidatePath("/admin/chat");
  revalidatePath("/admin/orders");
  redirect(
    "/admin/chat?view=active&type=service&conversation=" +
      encodeURIComponent(conversationId),
  );
}
