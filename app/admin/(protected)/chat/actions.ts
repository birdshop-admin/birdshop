"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import type Stripe from "stripe";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  getStripe,
} from "@/lib/stripe";

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

type CancelPaymentRequestRow = {
  id: string;

  conversation_id: string;

  status: string;

  order_id:
    | string
    | null;

  stripe_checkout_session_id:
    | string
    | null;

  paid_at:
    | string
    | null;
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
    data:
      admin,
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
    | "error" =
    "success"
) {
  const params =
    new URLSearchParams();

  params.set(
    "view",
    view
  );

  if (
    conversationId
  ) {
    params.set(
      "conversation",
      conversationId
    );
  }

  if (
    message
  ) {
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

/* =========================================================
   REFRESH
========================================================= */

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
========================================================= */

export async function sendAdminChatMessage(
  formData:
    FormData
): Promise<SendAdminChatResult> {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ??
        ""
    ).trim();

  const body =
    String(
      formData.get(
        "body"
      ) ??
        ""
    ).trim();

  if (
    !conversationId
  ) {
    return {
      ok:
        false,

      error:
        "Conversation ID is missing.",
    };
  }

  if (
    !body
  ) {
    return {
      ok:
        false,

      error:
        "Enter a message before sending.",
    };
  }

  if (
    body.length >
    4000
  ) {
    return {
      ok:
        false,

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

  if (
    error
  ) {
    return {
      ok:
        false,

      error:
        error.message,
    };
  }

  return {
    ok:
      true,
  };
}

/* =========================================================
   CREATE PAYMENT REQUEST
========================================================= */

export async function createPaymentRequest(
  formData:
    FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ??
        ""
    ).trim();

  const amount =
    Number(
      formData.get(
        "amount"
      ) ??
        0
    );

  const title =
    String(
      formData.get(
        "title"
      ) ??
        ""
    ).trim();

  const description =
    String(
      formData.get(
        "description"
      ) ??
        ""
    ).trim();

  if (
    !conversationId
  ) {
    throw new Error(
      "Conversation ID missing."
    );
  }

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <
      0.5
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

  if (
    !title
  ) {
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

  if (
    error
  ) {
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
  formData:
    FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ??
        ""
    ).trim();

  const requestId =
    String(
      formData.get(
        "payment_request_id"
      ) ??
        ""
    ).trim();

  if (
    !conversationId ||
    !requestId
  ) {
    return;
  }

  /* =======================================================
     LOAD REQUEST
  ======================================================= */

  const {
    data:
      rawPaymentRequest,

    error:
      paymentLookupError,
  } =
    await supabase
      .from(
        "service_payment_requests"
      )
      .select(
        [
          "id",
          "conversation_id",
          "status",
          "order_id",
          "stripe_checkout_session_id",
          "paid_at",
        ].join(",")
      )
      .eq(
        "id",
        requestId
      )
      .eq(
        "conversation_id",
        conversationId
      )
      .maybeSingle();

  if (
    paymentLookupError
  ) {
    redirect(
      chatUrl(
        "active",
        conversationId,
        paymentLookupError.message,
        "error"
      )
    );
  }

  const paymentRequest =
    rawPaymentRequest as
      CancelPaymentRequestRow | null;

  if (
    !paymentRequest
  ) {
    redirect(
      chatUrl(
        "active",
        conversationId,
        "Payment request not found.",
        "error"
      )
    );
  }

  /* =======================================================
     DATABASE PAYMENT CHECK
  ======================================================= */

  if (
    paymentRequest.status ===
      "paid" ||
    Boolean(
      paymentRequest.paid_at
    ) ||
    Boolean(
      paymentRequest.order_id
    )
  ) {
    redirect(
      chatUrl(
        "active",
        conversationId,
        "This payment has already been completed and cannot be cancelled.",
        "error"
      )
    );
  }

  if (
    paymentRequest.status ===
    "cancelled"
  ) {
    redirect(
      chatUrl(
        "active",
        conversationId,
        "This payment request is already cancelled.",
        "error"
      )
    );
  }

  /* =======================================================
     STRIPE CHECKOUT
  ======================================================= */

  const stripeSessionId =
    paymentRequest
      .stripe_checkout_session_id
      ?.trim() ??
    "";

  if (
    stripeSessionId
  ) {
    const stripe =
      getStripe();

    let stripeSession:
      Stripe.Checkout.Session;

    /* =====================================================
       RETRIEVE SESSION
    ===================================================== */

    try {
      stripeSession =
        await stripe
          .checkout
          .sessions
          .retrieve(
            stripeSessionId
          );
    } catch (
      problem
    ) {
      const message =
        problem instanceof
          Error
          ? problem.message
          : "Unable to check Stripe Checkout.";

      redirect(
        chatUrl(
          "active",
          conversationId,
          `Payment cancellation stopped: ${message}`,
          "error"
        )
      );
    }

    /* =====================================================
       ALREADY COMPLETED

       Do not cancel something Stripe already accepted.
    ===================================================== */

    if (
      stripeSession.status ===
        "complete" ||
      stripeSession.payment_status ===
        "paid"
    ) {
      redirect(
        chatUrl(
          "active",
          conversationId,
          "Stripe Checkout has already completed. This payment cannot be cancelled.",
          "error"
        )
      );
    }

    /* =====================================================
       EXPIRE OPEN SESSION
    ===================================================== */

    if (
      stripeSession.status ===
      "open"
    ) {
      try {
        stripeSession =
          await stripe
            .checkout
            .sessions
            .expire(
              stripeSessionId
            );
      } catch (
        problem
      ) {
        const message =
          problem instanceof
            Error
            ? problem.message
            : "Unable to expire Stripe Checkout.";

        redirect(
          chatUrl(
            "active",
            conversationId,
            `Payment cancellation stopped: ${message}`,
            "error"
          )
        );
      }
    }

    /* =====================================================
       REQUIRE EXPIRED STATE
    ===================================================== */

    if (
      stripeSession.status !==
      "expired"
    ) {
      redirect(
        chatUrl(
          "active",
          conversationId,
          "Stripe Checkout could not be safely disabled.",
          "error"
        )
      );
    }
  }

  /* =======================================================
     CANCEL BIRDSHOP REQUEST

     Stripe is now either:
     - nonexistent
     - or expired
  ======================================================= */

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

  if (
    error
  ) {
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
      "Payment request cancelled and Stripe Checkout disabled."
    )
  );
}

/* =========================================================
   OPEN / CLOSE
========================================================= */

export async function setConversationStatus(
  formData:
    FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ??
        ""
    ).trim();

  const status =
    String(
      formData.get(
        "status"
      ) ??
        ""
    ).trim();

  if (
    !conversationId ||
    ![
      "open",
      "closed",
    ].includes(
      status
    )
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

  if (
    error
  ) {
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
  formData:
    FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ??
        ""
    ).trim();

  if (
    !conversationId
  ) {
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

  if (
    error
  ) {
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
  formData:
    FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ??
        ""
    ).trim();

  if (
    !conversationId
  ) {
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

  if (
    error
  ) {
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
  formData:
    FormData
) {
  const supabase =
    await requireAdmin();

  const conversationId =
    String(
      formData.get(
        "conversation_id"
      ) ??
        ""
    ).trim();

  if (
    !conversationId
  ) {
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

  if (
    error
  ) {
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