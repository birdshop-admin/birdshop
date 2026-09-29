import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import AdminGlobalChatNotifier from "@/components/AdminGlobalChatNotifier";

import styles from "./admin-shell.module.css";

export const dynamic =
  "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type StaffRole =
  | "owner"
  | "service_agent";

type StaffProfile = {
  user_id:
    string;

  role:
    StaffRole;

  display_name:
    | string
    | null;

  is_active:
    boolean;
};

/* =========================================================
   PROTECTED ADMIN LAYOUT
========================================================= */

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  const supabase =
    await createClient();

  /* =======================================================
     AUTHENTICATED USER
  ======================================================= */

  const {
    data:
      claimsData,

    error:
      claimsError,
  } =
    await supabase.auth
      .getClaims();

  const userId =
    claimsData
      ?.claims
      ?.sub;

  if (
    claimsError ||
    !userId
  ) {
    redirect(
      "/admin/login"
    );
  }

  /* =======================================================
     BIRDSHOP STAFF PROFILE

     IMPORTANT:

     We intentionally use the protected RPC instead of
     reading admin_users directly.

     This gives the application one consistent source for:

       owner
       service_agent
       active / disabled
  ======================================================= */

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
      userId ||
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

  const isOwner =
    profile.role ===
    "owner";

  /* =======================================================
     PROTECTED ADMIN
  ======================================================= */

  return (
    <div
      className={
        styles.shell
      }
    >
      {/* ===============================================
          OWNER GLOBAL CHAT NOTIFICATIONS

          Service Agents live directly inside their
          service-chat workspace.

          They should not receive Product Support or
          General Support notifications.
      =============================================== */}

      {isOwner && (
        <AdminGlobalChatNotifier />
      )}

      {
        children
      }
    </div>
  );
}