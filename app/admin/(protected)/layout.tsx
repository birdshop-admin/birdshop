import { requireStaff } from "@/lib/staff-auth";

import AdminGlobalChatNotifier from "@/components/AdminGlobalChatNotifier";
import AdminIdentityCard from "@/components/AdminIdentityCard";
import AdminSessionHeartbeat from "@/components/AdminSessionHeartbeat";

import styles from "./admin-shell.module.css";

export const dynamic = "force-dynamic";

// Scales the admin down on desktop windows smaller than about 1680 x 1000, never
// below 60%. Phones and tablets (under 1024px wide) and browsers without CSS zoom
// keep 100%.
const FIT_TO_SCREEN = "(function(){var d=document.documentElement;function s(){var w=innerWidth,h=innerHeight,z=1;if(w>=1024&&window.CSS&&CSS.supports('zoom','0.5')){z=Math.max(0.6,Math.min(1,w/1680,h/1000));z=Math.round(z*100)/100}d.style.setProperty('--admin-zoom',String(z))}s();addEventListener('resize',s)})();";

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
      {/* Fit-to-screen scaling: see admin-shell.module.css. Runs before paint. */}
      <script
        dangerouslySetInnerHTML={{
          __html: FIT_TO_SCREEN,
        }}
      />
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
