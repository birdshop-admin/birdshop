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

export type SendServiceAgentMessageResult =
  | {
      ok:
        true;
    }
  | {
      ok:
        false;

      error:
        string;
    };

type StaffProfile = {
  user_id:
    string;

  role:
    | "owner"
    | "service_agent";

  display_name:
    | string
    | null;

  is_active:
    boolean;
};

type CancelPaymentRequestRow = {
  id:
    string;

  conversation_id:
    string;

  status:
    string;

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
   STAFF AUTH
========================================================= */

async function requireStaff() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  if (!user) {
    redirect(
      "/admin/login"
    );
  }

  const {
    data:
      profileData,

    error:
      profileError,
  } =
    await supabase.rpc(
      "birdshop_get_my_staff_profile"
    );

  if (
    profileError ||
    !profileData
  ) {
    redirect(
      "/admin/login"
    );
  }

  const profile =
    profileData as
      StaffProfile;

  if (
    profile.user_id !==
      user.id ||
    profile.is_active !==
      true ||
    ![
      "owner",
      "service_agent",
    ].includes(
      profile.role
    )
  ) {
    redirect(
      "/admin/login"
    );
  }

  return {
    supabase,
    profile,
  };
}

/* =========================================================
   URL
========================================================= */

function serviceChatUrl(
  conversationId?:
    string
) {
  const params =
    new URLSearchParams();

  params.set(
    "view",
    "active"
  );

  params.set(
    "type",
    "service"
  );

  if (
    conversationId
  ) {
    params.set(
      "conversation",
      conversationId
    );
  }

  return `/admin/chat?${params.toString()}`;
}

/* =========================================================
   REFRESH
========================================================= */

function refreshChat() {
  revalidatePath(
    "/admin/chat"
  );

  revalidatePath(
    "/admin/orders"
  );

  revalidatePath(
    "/admin"
  );
}

/* =========================================================
   ACCEPT SERVICE
========================================================= */

export async function acceptServiceConversation(
  formData:
    FormData
) {
  const {
    supabase,
  } =
    await requireStaff();

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
    redirect(
      serviceChatUrl()
    );
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_staff_accept_service_conversation",
      {
        p_conversation_id:
          conversationId,
      }
    );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  refreshChat();

  redirect(
    serviceChatUrl(
      conversationId
    )
  );
}

/* =========================================================
   LEAVE SERVICE
========================================================= */

export async function leaveServiceConversation(
  formData:
    FormData
) {
  const {
    supabase,
  } =
    await requireStaff();

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
    redirect(
      serviceChatUrl()
    );
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_staff_leave_service_conversation",
      {
        p_conversation_id:
          conversationId,
      }
    );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  refreshChat();

  redirect(
    serviceChatUrl()
  );
}

/* =========================================================
   SEND MESSAGE
========================================================= */

export async function sendServiceAgentMessage(
  formData:
    FormData
): Promise<SendServiceAgentMessageResult> {
  const {
    supabase,
  } =
    await requireStaff();

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

export async function createServiceAgentPaymentRequest(
  formData:
    FormData
) {
  const {
    supabase,
  } =
    await requireStaff();

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
    redirect(
      serviceChatUrl()
    );
  }

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <
      0.5
  ) {
    throw new Error(
      "Enter a valid payment amount."
    );
  }

  if (
    !title
  ) {
    throw new Error(
      "Enter a payment title."
    );
  }

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_staff_create_payment_request",
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
    throw new Error(
      error.message
    );
  }

  refreshChat();

  redirect(
    serviceChatUrl(
      conversationId
    )
  );
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
   by the Owner payment system. :chatgpt-content-reference{index="0"}
========================================================= */

export async function cancelServiceAgentPaymentRequest(
  formData:
    FormData
) {
  const {
    supabase,
  } =
    await requireStaff();

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
    redirect(
      serviceChatUrl()
    );
  }

  /* =======================================================
     LOAD PAYMENT
  ======================================================= */

  const {
    data:
      paymentRaw,

    error:
      lookupError,
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
    lookupError
  ) {
    throw new Error(
      lookupError.message
    );
  }

  const payment =
    paymentRaw as
      CancelPaymentRequestRow | null;

  if (
    !payment
  ) {
    throw new Error(
      "Payment request not found."
    );
  }

  if (
    payment.status ===
      "paid" ||
    payment.paid_at
  ) {
    throw new Error(
      "This payment has already completed and cannot be cancelled."
    );
  }

  if (
    payment.status !==
    "pending"
  ) {
    throw new Error(
      "This payment request is no longer pending."
    );
  }

  /* =======================================================
     STRIPE CHECKOUT
  ======================================================= */

  const stripeSessionId =
    payment
      .stripe_checkout_session_id;

  if (
    stripeSessionId
  ) {
    const stripe =
      getStripe();

    let stripeSession:
      Stripe.Checkout.Session;

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
      throw new Error(
        problem instanceof
          Error
          ? `Unable to verify Stripe Checkout: ${problem.message}`
          : "Unable to verify Stripe Checkout."
      );
    }

    if (
      stripeSession.status ===
        "complete" ||
      stripeSession
        .payment_status ===
        "paid"
    ) {
      throw new Error(
        "Stripe Checkout already completed. This payment cannot be cancelled."
      );
    }

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
        throw new Error(
          problem instanceof
            Error
            ? `Unable to disable Stripe Checkout: ${problem.message}`
            : "Unable to disable Stripe Checkout."
        );
      }
    }

    if (
      stripeSession.status !==
      "expired"
    ) {
      throw new Error(
        "Stripe Checkout could not be safely disabled."
      );
    }
  }

  /* =======================================================
     CANCEL BIRDSHOP REQUEST
  ======================================================= */

  const {
    error,
  } =
    await supabase.rpc(
      "birdshop_staff_cancel_payment_request",
      {
        p_request_id:
          requestId,
      }
    );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  refreshChat();

  redirect(
    serviceChatUrl(
      conversationId
    )
  );
}