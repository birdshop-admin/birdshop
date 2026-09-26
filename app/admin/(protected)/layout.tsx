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
     ADMIN AUTHORIZATION
  ======================================================= */

  const {
    data:
      adminUser,

    error:
      adminError,
  } =
    await supabase
      .from(
        "admin_users"
      )
      .select(
        "user_id, role"
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  if (
    adminError ||
    !adminUser
  ) {
    redirect(
      "/admin/login"
    );
  }

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
          GLOBAL ADMIN CHAT NOTIFICATIONS

          Remains mounted while navigating between:
          Overview
          Products
          Inventory
          Orders
          Chat
          Legacy Support
          Reviews
      =============================================== */}

      <AdminGlobalChatNotifier />

      {
        children
      }
    </div>
  );
}