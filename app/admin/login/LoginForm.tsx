"use client";

import { useState, type FormEvent } from "react";

import { useRouter } from "next/navigation";

import styles from "./login.module.css";

type LoginResponse = {
  ok?: boolean;

  error?: string;

  destination?: string;
};

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/admin/login/session", {
        method: "POST",

        credentials: "same-origin",

        cache: "no-store",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: email.trim(),

          password,
        }),
      });

      let result: LoginResponse = {};

      try {
        result = (await response.json()) as LoginResponse;
      } catch {
        result = {};
      }

      if (!response.ok || !result.ok) {
        setError(result.error || "BirdShop could not verify this account.");

        return;
      }

      router.replace(result.destination || "/admin");
      router.refresh();
    } catch {
      setError(
        "BirdShop could not start the secure admin session. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="admin-email">EMAIL</label>

        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="staff@birdshop.store"
          required
        />
      </div>

      <div className={styles.field}>
        <div className={styles.passwordLabel}>
          <label htmlFor="admin-password">PASSWORD</label>

          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <input
          id="admin-password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          required
        />
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <button type="submit" className={styles.submit} disabled={loading}>
        <span>{loading ? "VERIFYING ACCESS..." : "SIGN IN TO BIRDSHOP"}</span>

        <span>→</span>
      </button>

      <p className={styles.securityNote}>Authorized BirdShop staff only.</p>
    </form>
  );
}
