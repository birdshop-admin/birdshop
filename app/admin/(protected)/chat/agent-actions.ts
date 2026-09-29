"use server";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

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

/* =========================================================
   REQUIRE CHAT STAFF
========================================================= */

async function requireChatStaff() {
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
   SEND SERVICE CHAT MESSAGE
========================================================= */

export async function sendServiceAgentMessage(
  formData:
    FormData
): Promise<SendServiceAgentMessageResult> {
  const {
    supabase,
  } =
    await requireChatStaff();

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

  /*
   * Security is enforced again inside PostgreSQL:
   *
   * OWNER
   *   → may send to any allowed conversation
   *
   * SERVICE AGENT
   *   → service conversations only
   */

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