import { requireStaff } from "@/lib/staff-auth";

import AdminGlobalChatNotifier from "@/components/AdminGlobalChatNotifier";
import AdminIdentityCard from "@/components/AdminIdentityCard";
import AdminSessionHeartbeat from "@/components/AdminSessionHeartbeat";

import styles from "./admin-shell.module.css";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile } = await requireStaff();
  const email = user.email ?? null;

  const isOwner = profile.role === "owner";

  const displayName =
    profile.display_name?.trim() || (isOwner ? "Owner" : "Service Staff");

  /* =======================================================
     PROTECTED ADMIN
  ======================================================= */

  return (
    <div className={styles.shell}>
      <AdminSessionHeartbeat />

      {isOwner && <AdminGlobalChatNotifier />}

      <AdminIdentityCard
        role={profile.role}
        displayName={displayName}
        email={email}
      />

      {children}
    </div>
  );
}
