"use client";

import {
  useState,
} from "react";

export default function AdminLogoutButton() {
  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  async function logout() {
    if (
      loading
    ) {
      return;
    }

    setLoading(
      true
    );

    try {
      await fetch(
        "/admin/logout?reason=manual",
        {
          method:
            "POST",

          credentials:
            "same-origin",

          cache:
            "no-store",
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