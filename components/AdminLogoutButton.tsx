"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/admin/logout?reason=manual", {
        method: "POST",

        credentials: "same-origin",

        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Sign-out did not complete. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={logout} disabled={loading}>
        {loading ? "Signing Out..." : "Sign Out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
