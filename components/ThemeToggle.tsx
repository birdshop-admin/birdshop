"use client";

import { useSyncExternalStore } from "react";

const themeEvent = "birdshop-theme-change";
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== "birdshop-theme") return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    callback();
  };
  window.addEventListener(themeEvent, callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(themeEvent, callback);
    window.removeEventListener("storage", storage);
  };
}
function getSnapshot() { return document.documentElement.dataset.theme === "dark"; }
function getServerSnapshot() { return false; }

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  function toggle() {
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("birdshop-theme", theme); } catch { /* Works without storage. */ }
    window.dispatchEvent(new Event(themeEvent));
  }
  return <button type="button" className="theme-toggle" onClick={toggle}
    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    aria-pressed={dark} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></>
        : <path d="M20.5 14.1A8.7 8.7 0 0 1 9.9 3.5 8.7 8.7 0 1 0 20.5 14.1Z" />}
    </svg>
    <span>{dark ? "Light mode" : "Dark mode"}</span>
  </button>;
}
