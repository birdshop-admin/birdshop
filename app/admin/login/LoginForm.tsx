"use client";

import {
  useState,
  type FormEvent,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  ADMIN_TAB_STORAGE_KEY,
} from "@/lib/admin-session";

import styles from "./login.module.css";

export default function LoginForm() {
  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const supabase =
        createClient();

      /* ===================================================
         SIGN IN
      =================================================== */

      const {
        data,
        error:
          signInError,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              email.trim(),

            password,
          });

      if (
        signInError ||
        !data.user
      ) {
        setError(
          "The email or password is incorrect."
        );

        setLoading(false);

        return;
      }

      /* ===================================================
         VERIFY ADMIN
      =================================================== */

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
            data.user.id
          )
          .maybeSingle();

      if (
        adminError ||
        !adminUser
      ) {
        await supabase.auth
          .signOut();

        setError(
          "This account is not authorized to access BirdShop administration."
        );

        setLoading(false);

        return;
      }

      /* ===================================================
         RESET ADMIN ACTIVITY TIMER

         This is the important fix.

         A previous admin session may have left an old
         birdshop_admin_last_active timestamp behind.

         Before entering /admin, refresh that timestamp so
         the proxy does not immediately consider this new
         login inactive.
      =================================================== */

      const heartbeatResponse =
        await fetch(
          "/admin/session/heartbeat",
          {
            method:
              "POST",

            credentials:
              "same-origin",

            cache:
              "no-store",
          }
        );

      if (
        !heartbeatResponse.ok
      ) {
        await supabase.auth
          .signOut();

        setError(
          "BirdShop could not initialize the secure admin session. Please try again."
        );

        setLoading(false);

        return;
      }

      /* ===================================================
         TAB-ONLY ACCESS MARKER

         sessionStorage survives refreshes but is removed
         automatically when this browser tab is closed.
      =================================================== */

      window.sessionStorage.setItem(
        ADMIN_TAB_STORAGE_KEY,
        "1"
      );

      /* ===================================================
         ENTER ADMIN

         Full navigation makes sure the server receives the
         freshly updated Supabase + activity cookies.
      =================================================== */

      window.location.replace(
        "/admin"
      );
    } catch {
      setError(
        "BirdShop could not start the admin session. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <form
      className={
        styles.form
      }
      onSubmit={
        handleSubmit
      }
    >
      <div
        className={
          styles.field
        }
      >
        <label
          htmlFor="admin-email"
        >
          EMAIL
        </label>

        <input
          id="admin-email"
          type="email"
          autoComplete="email"
          value={
            email
          }
          onChange={(
            event
          ) =>
            setEmail(
              event.target.value
            )
          }
          placeholder="owner@birdshop.gg"
          required
        />
      </div>

      <div
        className={
          styles.field
        }
      >
        <div
          className={
            styles.passwordLabel
          }
        >
          <label
            htmlFor="admin-password"
          >
            PASSWORD
          </label>

          <button
            type="button"
            onClick={() =>
              setShowPassword(
                (
                  current
                ) =>
                  !current
              )
            }
          >
            {showPassword
              ? "Hide"
              : "Show"}
          </button>
        </div>

        <input
          id="admin-password"
          type={
            showPassword
              ? "text"
              : "password"
          }
          autoComplete="current-password"
          value={
            password
          }
          onChange={(
            event
          ) =>
            setPassword(
              event.target.value
            )
          }
          placeholder="Enter your password"
          required
        />
      </div>

      {error && (
        <div
          className={
            styles.error
          }
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        className={
          styles.submit
        }
        disabled={
          loading
        }
      >
        <span>
          {loading
            ? "VERIFYING ACCESS..."
            : "SIGN IN TO BIRDSHOP"}
        </span>

        <span>
          →
        </span>
      </button>

      <p
        className={
          styles.securityNote
        }
      >
        Authorized BirdShop
        staff only.
      </p>
    </form>
  );
}