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
   LAYOUT
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
     AUTH
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

  const email =
    typeof claimsData
      ?.claims
      ?.email ===
    "string"
      ? claimsData
          .claims
          .email
      : null;

  if (
    claimsError ||
    !userId
  ) {
    redirect(
      "/admin/login"
    );
  }

  /* =======================================================
     STAFF PROFILE
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

  const displayName =
    profile.display_name
      ?.trim() ||
    email ||
    (isOwner
      ? "BirdShop Owner"
      : "Service Staff");

  /* =======================================================
     ADMIN
  ======================================================= */

  return (
    <div
      className={
        styles.shell
      }
    >
      {isOwner && (
        <AdminGlobalChatNotifier />
      )}

      {/* =================================================
          SIGNED-IN STAFF INDICATOR

          Temporary functional version.
          We'll redesign this with the whole Admin UI later.
      ================================================= */}

      <div
        style={{
          position:
            "fixed",

          top:
            "14px",

          right:
            "18px",

          zIndex:
            999,

          display:
            "flex",

          alignItems:
            "center",

          gap:
            "11px",

          padding:
            "8px 12px",

          border:
            "1px solid rgba(83, 101, 77, 0.2)",

          borderRadius:
            "7px",

          background:
            "rgba(241, 238, 228, 0.96)",

          boxShadow:
            "0 8px 25px rgba(15, 25, 17, 0.08)",

          backdropFilter:
            "blur(12px)",

          color:
            "#263126",
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                "7px",

              fontWeight:
                700,

              letterSpacing:
                "0.18em",

              color:
                "#768173",
            }}
          >
            SIGNED IN AS
          </div>

          <div
            style={{
              marginTop:
                "2px",

              fontFamily:
                "Georgia, 'Times New Roman', serif",

              fontSize:
                "12px",
            }}
          >
            {
              displayName
            }
          </div>
        </div>

        <span
          style={{
            padding:
              "5px 7px",

            borderRadius:
              "999px",

            background:
              isOwner
                ? "#263b2c"
                : "#596b51",

            color:
              "#f0ece2",

            fontSize:
              "7px",

            fontWeight:
              700,

            letterSpacing:
              "0.14em",
          }}
        >
          {isOwner
            ? "OWNER"
            : "SERVICE AGENT"}
        </span>
      </div>

      {
        children
      }
    </div>
  );
}