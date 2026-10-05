"use client";

import {
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import styles from "./AdminRefreshButton.module.css";

export default function AdminRefreshButton() {
  const router =
    useRouter();

  const [
    refreshing,
    startTransition,
  ] =
    useTransition();

  function refresh() {
    startTransition(
      () => {
        router.refresh();
      }
    );
  }

  return (
    <button
      type="button"
      className={
        styles.button
      }
      onClick={
        refresh
      }
      disabled={
        refreshing
      }
      title="Refresh BirdShop admin data"
    >
      <span
        className={
          refreshing
            ? styles.iconRefreshing
            : styles.icon
        }
      >
        ↻
      </span>

      <span>
        {refreshing
          ? "Refreshing..."
          : "Refresh"}
      </span>
    </button>
  );
}