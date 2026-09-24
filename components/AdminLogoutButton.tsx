"use client";

import {
  useState,
} from "react";

import {
  ADMIN_TAB_STORAGE_KEY,
} from "@/lib/admin-session";

export default function AdminLogoutButton() {
  const [
    loading,
    setLoading,
  ] =
    useState(false);

  async function logout() {
    setLoading(true);

    window.sessionStorage.removeItem(
      ADMIN_TAB_STORAGE_KEY
    );

    try {
      await fetch(
        "/admin/logout?reason=manual",
        {
          method:
            "POST",

          credentials:
            "same-origin",
        }
      );
    } finally {
      window.location.replace(
        "/admin/login"
      );
    }
  }

  return (
    <button
      type="button"
      onClick={
        logout
      }
      disabled={
        loading
      }
    >
      {loading
        ? "Signing Out..."
        : "Sign Out"}
    </button>
  );
}