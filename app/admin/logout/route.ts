import { assertSameOrigin } from "@/lib/server-config";
import { NextRequest, NextResponse } from "next/server";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import {
  ADMIN_ACTIVITY_COOKIE,
  ADMIN_SESSION_COOKIE,
} from "@/lib/admin-session";

/* =========================================================
   COOKIE OPTIONS
========================================================= */

function deleteCookieOptions() {
  return {
    path: "/admin",

    maxAge: 0,
  };
}

/* =========================================================
   END SESSION
========================================================= */

async function endSession() {
  const supabase = await createClient();

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /*
     * BirdShop cookies are still cleared even if the
     * Supabase sign-out request itself fails.
     */
  }

  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, "", deleteCookieOptions());

  cookieStore.set(ADMIN_ACTIVITY_COOKIE, "", deleteCookieOptions());

  /*
   * Legacy session cookies.
   */

  cookieStore.set("birdshop_admin_exit", "", deleteCookieOptions());
}

/* =========================================================
   REASON
========================================================= */

function reasonFromRequest(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason");

  if (reason === "inactive" || reason === "session" || reason === "closed") {
    return reason;
  }

  return null;
}

/* =========================================================
   POST
========================================================= */

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  await endSession();

  return NextResponse.json({
    ok: true,

    reason: reasonFromRequest(request),
  });
}

/* =========================================================
   GET
========================================================= */

export async function GET(request: NextRequest) {
  // GET never changes authentication state. Use the sign-out button to POST.

  const loginUrl = new URL("/admin/login", request.url);

  const reason = reasonFromRequest(request);

  if (reason) {
    loginUrl.searchParams.set("reason", reason);
  }

  return NextResponse.redirect(loginUrl);
}
