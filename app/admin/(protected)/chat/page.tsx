import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import OwnerAdminChatPage from "./OwnerAdminChatPage";
import ServiceAgentChatPage from "./ServiceAgentChatPage";

/* =========================================================
   TYPES
========================================================= */

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

type PageProps = {
  searchParams:
    Promise<{
      view?:
        string;

      type?:
        string;

      conversation?:
        string;

      message?:
        string;

      tone?:
        string;
    }>;
};

/* =========================================================
   ROLE ROUTER
========================================================= */

export default async function AdminChatPage({
  searchParams,
}: PageProps) {
  const supabase =
    await createClient();

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
    true
  ) {
    redirect(
      "/admin/login"
    );
  }

  /* =======================================================
     OWNER
  ======================================================= */

  if (
    profile.role ===
    "owner"
  ) {
    return (
      <OwnerAdminChatPage
        searchParams={
          searchParams
        }
      />
    );
  }

  /* =======================================================
     SERVICE AGENT
  ======================================================= */

  if (
    profile.role ===
    "service_agent"
  ) {
    return (
      <ServiceAgentChatPage
        searchParams={
          searchParams
        }
      />
    );
  }

  redirect(
    "/admin/login"
  );
}