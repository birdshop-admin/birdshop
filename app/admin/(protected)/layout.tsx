import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import AdminSessionGuard from "@/components/AdminSessionGuard";
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

  return (
    <div
      className={
        styles.shell
      }
    >
      <AdminSessionGuard>
        {/* ===============================================
            GLOBAL ADMIN CHAT NOTIFICATIONS

            This stays mounted while moving between:
            Overview / Products / Inventory / Orders /
            Chat / Support / Reviews.
        =============================================== */}

        <AdminGlobalChatNotifier />

        {
          children
        }
      </AdminSessionGuard>
    </div>
  );
}