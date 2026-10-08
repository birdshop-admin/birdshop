import Image from "next/image";

import { redirect } from "next/navigation";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

import LoginForm from "./LoginForm";

import styles from "./login.module.css";

export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type LoginPageProps = {
  searchParams: Promise<{
    reason?: string;
  }>;
};

type StaffProfile = {
  user_id: string;

  role: "owner" | "service_agent";

  display_name: string | null;

  is_active: boolean;
};

/* =========================================================
   PAGE
========================================================= */

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  const cookieStore = await cookies();

  const adminSession = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  const sessionStillActive = Boolean(adminSession);

  if (sessionStillActive) {
    const supabase = await createClient();

    // Same server-verified check as requireStaff: a locally valid JWT for a
    // session revoked in Supabase must show the form, not bounce back to /admin.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    const userId = userError ? undefined : user?.id;

    if (userId) {
      const { data: profileData } = await supabase.rpc(
        "birdshop_get_my_staff_profile",
      );

      const profile = profileData as StaffProfile | null;

      if (profile && profile.user_id === userId && profile.is_active === true) {
        if (profile.role === "service_agent") {
          redirect("/admin/chat?view=active&type=service");
        }

        if (profile.role === "owner") {
          redirect("/admin");
        }
      }
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.grid} />

      <div className={styles.glow} />

      <section className={styles.loginCard}>
        <div className={styles.brandSide}>
          <div className={styles.logoWrap}>
            <Image
              src="/cremebs.png"
              alt="BirdShop"
              width={110}
              height={110}
              loading="eager"
            />
          </div>

          <span className={styles.brandEyebrow}>BIRDSHOP</span>

          <h1>Administration.</h1>

          <p>Secure access for authorized BirdShop staff.</p>

          <div className={styles.brandLine} />

          <small>PRODUCTS · SERVICES · ORDERS · SUPPORT</small>
        </div>

        <div className={styles.formSide}>
          <div className={styles.formHeading}>
            <span>STAFF ACCESS</span>

            <h2>Welcome back.</h2>

            <p>Sign in using your authorized BirdShop account.</p>
          </div>

          {(params.reason === "session" || params.reason === "closed") && (
            <div className={styles.sessionNotice}>
              Your previous BirdShop admin browser session has ended. Sign in
              again to continue.
            </div>
          )}

          <LoginForm />
        </div>
      </section>

      <p className={styles.bottomText}>BIRDSHOP SECURE ADMINISTRATION</p>
    </main>
  );
}
