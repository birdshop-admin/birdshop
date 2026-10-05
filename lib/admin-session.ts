// Browser-session cookies: no maxAge/expires. Every protected request also verifies
// the Supabase user and active staff role. Browser session restore may retain cookies.
export const ADMIN_SESSION_COOKIE = "birdshop_admin_session";
// Kept only to clear the old timestamp cookie during login/logout.
export const ADMIN_ACTIVITY_COOKIE = "birdshop_admin_last_active";

export const ADMIN_TAB_STORAGE_KEY = "birdshop_admin_tab_active";
