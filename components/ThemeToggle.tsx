"use client";

import { useSyncExternalStore, type MouseEvent } from "react";

type Theme = "light" | "dark";

const themeEvent = "birdshop-theme-change";
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== "birdshop-theme") return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    callback();
  };
  // The site always opens in light mode unless the visitor chose dark.
  window.addEventListener(themeEvent, callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(themeEvent, callback);
    window.removeEventListener("storage", storage);
  };
}
function getSnapshot() { return document.documentElement.dataset.theme === "dark"; }
function getServerSnapshot() { return false; }

// The reveal in progress (a rapid second click finishes it instantly instead of
// stacking two), and the theme it will commit once its update callback runs.
let activeTransition: ViewTransition | null = null;
let pendingTheme: Theme | null = null;

function currentTheme(): Theme {
  if (pendingTheme) return pendingTheme;
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function commitTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("birdshop-theme", theme); } catch { /* Works without storage. */ }
  window.dispatchEvent(new Event(themeEvent));
}

// Instant swap. html.theme-switching (theme.css) suppresses every CSS transition
// until the new colours have painted, so the page does not fade unevenly.
function commitInstantly(theme: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  commitTheme(theme);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!activeTransition) root.classList.remove("theme-switching");
  }));
}

// Reveals the new theme as a circle growing from (x, y). Falls back to an instant
// swap for reduced motion, browsers without View Transitions, or a hidden tab.
function switchTheme(theme: Theme, x: number, y: number) {
  const root = document.documentElement;
  activeTransition?.skipTransition();
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || typeof document.startViewTransition !== "function"
    || document.visibilityState !== "visible"
  ) {
    commitInstantly(theme);
    return;
  }

  root.classList.add("theme-switching");
  pendingTheme = theme;
  const transition = document.startViewTransition(() => {
    commitTheme(theme);
    if (pendingTheme === theme) pendingTheme = null;
  });
  activeTransition = transition;

  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  transition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 420, easing: "cubic-bezier(0.2, 0.75, 0.25, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  }).catch(() => { /* Skipped: the theme is still committed by the update callback. */ });

  const finish = () => {
    if (activeTransition !== transition) return;
    activeTransition = null;
    root.classList.remove("theme-switching");
  };
  transition.finished.then(finish, finish);
}

function handleToggle(event: MouseEvent<HTMLButtonElement>) {
  // Once tried, the first-visit glow is no longer needed.
  delete document.documentElement.dataset.themeHint;
  // Read the next theme from the DOM, not a possibly stale render. The origin is
  // the control's centre, which also works for keyboard activation.
  const rect = event.currentTarget.getBoundingClientRect();
  switchTheme(currentTheme() === "dark" ? "light" : "dark", rect.left + rect.width / 2, rect.top + rect.height / 2);
}

// Placed in the site header (desktop), the mobile menu, or the admin sidebar, so it
// never floats over page controls; "floating" is only the fallback for bare pages.
// The static label is the accessible name; the switch state is aria-checked, and
// the on/off visuals come from html[data-theme] in theme.css (no hydration flash).
export default function ThemeToggle({
  placement = "floating",
}: {
  placement?: "floating" | "header" | "menu" | "sidebar";
}) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <button type="button" role="switch" aria-checked={dark}
    className={`theme-toggle theme-toggle-${placement}`} onClick={handleToggle}>
    <svg className="theme-toggle-icon" viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.1A8.7 8.7 0 0 1 9.9 3.5 8.7 8.7 0 1 0 20.5 14.1Z" />
    </svg>
    <span className="theme-toggle-label">Dark mode</span>
    <span className="theme-toggle-track" aria-hidden="true"><i /></span>
  </button>;
}
