import { assertSameOrigin, readBody } from "@/lib/server-config";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import {
  ADMIN_ACTIVITY_COOKIE,
  ADMIN_SESSION_COOKIE,
} from "@/lib/admin-session";

/* =========================================================
   RUNTIME
========================================================= */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type LoginBody = {
  email?: unknown;

  password?: unknown;
};

type StaffProfile = {
  user_id: string;

  role: "owner" | "service_agent";

  display_name: string | null;

  is_active: boolean;
};

/* =========================================================
   COOKIE OPTIONS
========================================================= */

function sessionCookieOptions() {
  return {
    httpOnly: true,

    sameSite: "strict" as const,

    secure: process.env.NODE_ENV === "production",

    path: "/admin",
  };
}

/* =========================================================
   CLEAR BIRDSHOP SESSION
========================================================= */

async function clearBirdShopSession() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    ...sessionCookieOptions(),

    maxAge: 0,
  });

  cookieStore.set(ADMIN_ACTIVITY_COOKIE, "", {
    ...sessionCookieOptions(),

    maxAge: 0,
  });

  /*
   * Remove cookies from older versions too.
   */

  cookieStore.set("birdshop_admin_exit", "", {
    path: "/admin",

    maxAge: 0,
  });
}

/* =========================================================
   POST LOGIN
========================================================= */

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    assertSameOrigin(request);
    await limitRequest(request, "staff-login", 20, 900);
    body = JSON.parse(await readBody(request, 8192)) as LoginBody;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid login request.",
      },
      {
        status: 400,
      },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";

  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password || email.length > 320 || password.length > 1024) {
    return NextResponse.json(
      {
        error: "Enter your email and password.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    await rateLimit("staff-login-account", email.toLowerCase(), 10, 900);
  } catch {
    return NextResponse.json(
      { error: "Too many login attempts. Wait a few minutes and retry." },
      { status: 429 },
    );
  }
  const supabase = await createClient();

  /* =======================================================
     PASSWORD AUTHENTICATION

     This happens on the BirdShop server route.

     The admin-session gate is only created AFTER the
     password is successfully verified.
  ======================================================= */

  const {
    data: signInData,

    error: signInError,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.user) {
    await clearBirdShopSession();

    return NextResponse.json(
      {
        error: "The email or password is incorrect.",
      },
      {
        status: 401,
      },
    );
  }

  /* =======================================================
     STAFF AUTHORIZATION
  ======================================================= */

  const {
    data: profileData,

    error: profileError,
  } = await supabase.rpc("birdshop_get_my_staff_profile");

  if (profileError || !profileData) {
    await supabase.auth.signOut({ scope: "local" });

    await clearBirdShopSession();

    return NextResponse.json(
      {
        error:
          "This account is not authorized to access BirdShop administration.",
      },
      {
        status: 403,
      },
    );
  }

  const profile = profileData as StaffProfile;

  if (
    profile.user_id !== signInData.user.id ||
    profile.is_active !== true ||
    !["owner", "service_agent"].includes(profile.role)
  ) {
    await supabase.auth.signOut({ scope: "local" });

    await clearBirdShopSession();

    return NextResponse.json(
      {
        error:
          "This account is not authorized to access BirdShop administration.",
      },
      {
        status: 403,
      },
    );
  }

  /* =======================================================
     CREATE BROWSER-SESSION GATE

     IMPORTANT:

     No maxAge.
     No expires.

     This is intentionally a browser-session cookie.
  ======================================================= */

  const cookieStore = await cookies();

  const now = Date.now();

  cookieStore.set(ADMIN_SESSION_COOKIE, randomUUID(), sessionCookieOptions());

  cookieStore.set(ADMIN_ACTIVITY_COOKIE, String(now), sessionCookieOptions());

  /* =======================================================
     DESTINATION
  ======================================================= */

  const destination =
    profile.role === "service_agent"
      ? "/admin/chat?view=active&type=service"
      : "/admin";

  return NextResponse.json({
    ok: true,

    destination,

    role: profile.role,

    displayName: profile.display_name,
  });
}
