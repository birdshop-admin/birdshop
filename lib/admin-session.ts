/* =========================================================
   BIRDSHOP ADMIN SESSION SETTINGS
========================================================= */

/*
 * 15 minutes without REAL user activity.
 */
export const ADMIN_IDLE_TIMEOUT_MS =
  15 * 60 * 1000;

/*
 * Reserved for a future visual timeout warning.
 *
 * Example:
 * "Your session will expire in 60 seconds."
 */
export const ADMIN_IDLE_WARNING_MS =
  60 * 1000;

/*
 * The client checks periodically whether the user has
 * actually been active.
 *
 * It does NOT blindly refresh the session forever.
 */
export const ADMIN_HEARTBEAT_INTERVAL_MS =
  30 * 1000;

/*
 * If activity occurred within this window, the periodic
 * heartbeat is allowed to refresh the server timestamp.
 */
export const ADMIN_RECENT_ACTIVITY_MS =
  60 * 1000;

/*
 * Server-side last real activity timestamp.
 *
 * SESSION COOKIE:
 * no maxAge
 * no expires
 */
export const ADMIN_ACTIVITY_COOKIE =
  "birdshop_admin_last_active";

/*
 * Separate BirdShop admin browser-session gate.
 *
 * Supabase authentication alone is NOT enough to enter
 * BirdShop Administration.
 */
export const ADMIN_SESSION_COOKIE =
  "birdshop_admin_session";

/*
 * Legacy key kept temporarily so older deployed client code
 * does not break during rollout.
 *
 * The new session system does not depend on this.
 */
export const ADMIN_TAB_STORAGE_KEY =
  "birdshop_admin_tab_active";