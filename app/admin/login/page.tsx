import Image from "next/image";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import LoginForm from "./LoginForm";

import styles from "./login.module.css";

export const dynamic =
  "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    reason?: string;
  }>;
};

export default async function AdminLoginPage({
  searchParams,
}: LoginPageProps) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data:
      claimsData,
  } =
    await supabase.auth
      .getClaims();

  const userId =
    claimsData
      ?.claims
      ?.sub;

  if (
    userId
  ) {
    const {
      data:
        adminUser,
    } =
      await supabase
        .from(
          "admin_users"
        )
        .select(
          "user_id"
        )
        .eq(
          "user_id",
          userId
        )
        .maybeSingle();

    if (
      adminUser
    ) {
      redirect(
        "/admin"
      );
    }
  }

  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.grid
        }
      />

      <div
        className={
          styles.glow
        }
      />

      <section
        className={
          styles.loginCard
        }
      >
        <div
          className={
            styles.brandSide
          }
        >
          <div
            className={
              styles.logoWrap
            }
          >
            <Image
              src="/cremebs.png"
              alt="BirdShop"
              width={110}
              height={110}
              priority
            />
          </div>

          <span
            className={
              styles.brandEyebrow
            }
          >
            BIRDSHOP
          </span>

          <h1>
            Administration.
          </h1>

          <p>
            Secure access for
            authorized BirdShop
            staff.
          </p>

          <div
            className={
              styles.brandLine
            }
          />

          <small>
            PRODUCTS · SERVICES
            · ORDERS · SUPPORT
          </small>
        </div>

        <div
          className={
            styles.formSide
          }
        >
          <div
            className={
              styles.formHeading
            }
          >
            <span>
              STAFF ACCESS
            </span>

            <h2>
              Welcome back.
            </h2>

            <p>
              Sign in using your
              authorized BirdShop
              account.
            </p>
          </div>

          {params.reason ===
            "inactive" && (
            <div
              className={
                styles.sessionNotice
              }
            >
              Your admin session
              ended after 3 minutes
              of inactivity.
            </div>
          )}

          {params.reason ===
            "closed" && (
            <div
              className={
                styles.sessionNotice
              }
            >
              Your admin session
              ended because the
              admin page was closed
              or refreshed.
            </div>
          )}

          <LoginForm />
        </div>
      </section>

      <p
        className={
          styles.bottomText
        }
      >
        BIRDSHOP SECURE
        ADMINISTRATION
      </p>
    </main>
  );
}