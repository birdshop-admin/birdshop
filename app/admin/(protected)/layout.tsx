import { requireStaff } from "@/lib/staff-auth";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import AdminGlobalChatNotifier from "@/components/AdminGlobalChatNotifier";
import AdminIdentityCard from "@/components/AdminIdentityCard";
import AdminSessionHeartbeat from "@/components/AdminSessionHeartbeat";

import styles from "./admin-shell.module.css";

export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type StaffRole = "owner" | "service_agent";

type StaffProfile = {
  user_id: string;

  role: StaffRole;

  display_name: string | null;

  is_active: boolean;
};

/* =========================================================
   LAYOUT
========================================================= */

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireStaff();

  const supabase = await createClient();

  /* =======================================================
     AUTH
  ======================================================= */

  const {
    data: claimsData,

    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  const email =
    typeof claimsData?.claims?.email === "string"
      ? claimsData.claims.email
      : null;

  if (claimsError || !userId) {
    redirect("/admin/login");
  }

  /* =======================================================
     STAFF PROFILE
  ======================================================= */

  const {
    data: profileData,

    error: profileError,
  } = await supabase.rpc("birdshop_get_my_staff_profile");

  if (profileError || !profileData) {
    redirect("/admin/login");
  }

  const profile = profileData as StaffProfile;

  if (
    profile.user_id !== userId ||
    profile.is_active !== true ||
    !["owner", "service_agent"].includes(profile.role)
  ) {
    redirect("/admin/login");
  }

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
