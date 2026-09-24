"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

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
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/admin/login"
    );
  }

  const {
    data: admin,
  } =
    await supabase
      .from(
        "admin_users"
      )
      .select(
        "user_id"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  if (!admin) {
    redirect(
      "/admin/login"
    );
  }

  return supabase;
}

/* =========================================================
   URL
========================================================= */

function chatUrl(
  view: string,
  conversationId?: string,
  message?: string,
  tone:
    | "success"
    | "error" = "success"
) {
  const params =
    new URLSearchParams();

  params.set(
    "view",
    view
  );

  if (conversationId) {
    params.set(
      "conversation",
      conversationId
    );
  }

  if (message) {
    params.set(
      "message",
      message
    );

    params.set(
      "tone",
      tone
    );
  }

  return `/admin/chat?${params.toString()}`;
}

function refreshAdmin() {
  revalidatePath(
    "/admin"
  );

  revalidatePath(
    "/admin/chat"
  );

  revalidatePath(
    "/admin/orders"
  );
}

/* =========================================================
   SEND CHAT MESSAGE

   IMPORTANT:
   NO REDIRECT
   NO REVALIDATE
   NO ROUTER REFRESH

   AdminLiveThread handles the message UI itself.
========================================================= */

export async function sendAdminChatMessage(
  formData: FormData
): Promise<SendAdminChatResult> {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ?? ""
    ).trim();

  const body =
    String(
      formData.get(
        "body"
      ) ?? ""
    ).trim();

  if (!conversationId) {
    return {
      ok: false,
      error:
        "Conversation ID is missing.",
    };
  }

  if (!body) {
    return {
      ok: false,
      error:
        "Enter a message before sending.",
    };
  }

  if (
    body.length >
    4000
  ) {
    return {
      ok: false,
      error:
        "Message is too long.",
    };
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_admin_send_service_chat_message",
      {
        p_conversation_id:
          conversationId,

        p_body:
          body,
      }
    );

  if (error) {
    return {
      ok: false,
      error:
        error.message,
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   CREATE PAYMENT REQUEST
========================================================= */

export async function createPaymentRequest(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ?? ""
    ).trim();

  const amount =
    Number(
      formData.get(
        "amount"
      ) ?? 0
    );

  const title =
    String(
      formData.get(
        "title"
      ) ?? ""
    ).trim();

  const description =
    String(
      formData.get(
        "description"
      ) ?? ""
    ).trim();

  if (!conversationId) {
    throw new Error(
      "Conversation ID missing."
    );
  }

  if (
    !Number.isFinite(
      amount
    ) ||
    amount < 0.5
  ) {
    redirect(
      chatUrl(
        "active",
        conversationId,
        "Enter a valid payment amount.",
        "error"
      )
    );
  }

  if (!title) {
    redirect(
      chatUrl(
        "active",
        conversationId,
        "Enter a payment title.",
        "error"
      )
    );
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_admin_create_payment_request",
      {
        p_conversation_id:
          conversationId,

        p_amount:
          amount,

        p_title:
          title,

        p_description:
          description ||
          null,
      }
    );

  if (error) {
    redirect(
      chatUrl(
        "active",
        conversationId,
        error.message,
        "error"
      )
    );
  }

  refreshAdmin();

  redirect(
    chatUrl(
      "active",
      conversationId,
      "Payment request sent."
    )
  );
}

/* =========================================================
   CANCEL PAYMENT REQUEST
========================================================= */

export async function cancelPaymentRequest(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ?? ""
    ).trim();

  const requestId =
    String(
      formData.get(
        "payment_request_id"
      ) ?? ""
    ).trim();

  if (
    !conversationId ||
    !requestId
  ) {
    return;
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_admin_cancel_payment_request",
      {
        p_request_id:
          requestId,
      }
    );

  if (error) {
    redirect(
      chatUrl(
        "active",
        conversationId,
        error.message,
        "error"
      )
    );
  }

  refreshAdmin();

  redirect(
    chatUrl(
      "active",
      conversationId,
      "Payment request cancelled."
    )
  );
}

/* =========================================================
   OPEN / CLOSE
========================================================= */

export async function setConversationStatus(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ?? ""
    ).trim();

  const status =
    String(
      formData.get(
        "status"
      ) ?? ""
    ).trim();

  if (
    !conversationId ||
    ![
      "open",
      "closed",
    ].includes(status)
  ) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "service_conversations"
      )
      .update({
        status,
      })
      .eq(
        "id",
        conversationId
      )
      .is(
        "deleted_at",
        null
      );

  if (error) {
    redirect(
      chatUrl(
        status ===
          "open"
          ? "closed"
          : "active",

        conversationId,

        error.message,

        "error"
      )
    );
  }

  refreshAdmin();

  redirect(
    chatUrl(
      status ===
        "closed"
        ? "closed"
        : "active",

      conversationId
    )
  );
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteConversation(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ?? ""
    ).trim();

  if (!conversationId) {
    return;
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_admin_delete_service_conversation",
      {
        p_conversation_id:
          conversationId,
      }
    );

  if (error) {
    redirect(
      chatUrl(
        "closed",
        conversationId,
        error.message,
        "error"
      )
    );
  }

  refreshAdmin();

  redirect(
    chatUrl(
      "deleted",
      undefined,
      "Conversation moved to Deleted."
    )
  );
}

/* =========================================================
   RESTORE
========================================================= */

export async function restoreConversation(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ?? ""
    ).trim();

  if (!conversationId) {
    return;
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_admin_restore_service_conversation",
      {
        p_conversation_id:
          conversationId,
      }
    );

  if (error) {
    redirect(
      chatUrl(
        "deleted",
        undefined,
        error.message,
        "error"
      )
    );
  }

  refreshAdmin();

  redirect(
    chatUrl(
      "closed",
      conversationId,
      "Conversation restored."
    )
  );
}

/* =========================================================
   PERMANENT DELETE
========================================================= */

export async function permanentlyDeleteConversation(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ?? ""
    ).trim();

  if (!conversationId) {
    return;
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_admin_permanently_delete_service_conversation",
      {
        p_conversation_id:
          conversationId,
      }
    );

  if (error) {
    redirect(
      chatUrl(
        "deleted",
        undefined,
        error.message,
        "error"
      )
    );
  }

  refreshAdmin();

  redirect(
    chatUrl(
      "deleted",
      undefined,
      "Conversation permanently deleted."
    )
  );
}