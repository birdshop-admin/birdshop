import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  ADMIN_ACTIVITY_COOKIE,
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_SESSION_COOKIE,
} from "@/lib/admin-session";

/* =========================================================
   TYPES
========================================================= */

type StaffRole =
  | "owner"
  | "service_agent";

type StaffProfile = {
  user_id:
    string;

  role:
    StaffRole;

  display_name:
    | string
    | null;

  is_active:
    boolean;
};

/* =========================================================
   REDIRECT WITH SUPABASE COOKIES

   Supabase may refresh/delete authentication cookies during
   this request.

   Any redirect we create must preserve those cookie changes.
========================================================= */

function redirectWithSupabaseCookies({
  request,
  supabaseResponse,
  pathname,
  searchParams,
}: {
  request:
    NextRequest;

  supabaseResponse:
    NextResponse;

  pathname:
    string;

  searchParams?:
    URLSearchParams;
}) {
  const url =
    request.nextUrl.clone();

  url.pathname =
    pathname;

  url.search =
    searchParams &&
    searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

  const redirectResponse =
    NextResponse.redirect(
      url
    );

  for (
    const cookie
    of supabaseResponse
      .cookies
      .getAll()
  ) {
    redirectResponse
      .cookies
      .set(
        cookie
      );
  }

  return redirectResponse;
}

/* =========================================================
   LOGIN REDIRECT
========================================================= */

function redirectToLogin({
  request,
  supabaseResponse,
  reason,
}: {
  request:
    NextRequest;

  supabaseResponse:
    NextResponse;

  reason?:
    "inactive"
    | "session";
}) {
  const searchParams =
    new URLSearchParams();

  if (
    reason
  ) {
    searchParams.set(
      "reason",
      reason
    );
  }

  return redirectWithSupabaseCookies({
    request,

    supabaseResponse,

    pathname:
      "/admin/login",

    searchParams,
  });
}

/* =========================================================
   ADMIN SESSION PROXY
========================================================= */

export async function updateSession(
  request:
    NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  /* =======================================================
     SUPABASE SERVER CLIENT

     This handles authentication-cookie refreshes while the
     request moves through the proxy.
  ======================================================= */

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,

      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,

      {
        cookies: {
          getAll() {
            return request
              .cookies
              .getAll();
          },

          setAll(
            cookiesToSet
          ) {
            /*
             * Update the request copy.
             */

            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request
                  .cookies
                  .set(
                    name,
                    value
                  );
              }
            );

            /*
             * Create a fresh response containing the updated
             * request.
             */

            supabaseResponse =
              NextResponse.next({
                request,
              });

            /*
             * Return refreshed Supabase cookies to browser.
             */

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                supabaseResponse
                  .cookies
                  .set(
                    name,
                    value,
                    options
                  );
              }
            );
          },
        },
      }
    );

  /* =======================================================
     ROUTE CLASSIFICATION
  ======================================================= */

  const pathname =
    request.nextUrl.pathname;

  const isAdminRoute =
    pathname ===
      "/admin" ||
    pathname.startsWith(
      "/admin/"
    );

  /*
   * Everything underneath /admin/login must remain reachable,
   * including:
   *
   * /admin/login
   * /admin/login/session
   */

  const isLoginRoute =
    pathname ===
      "/admin/login" ||
    pathname.startsWith(
      "/admin/login/"
    );

  const isLogoutRoute =
    pathname ===
      "/admin/logout";

  /*
   * Heartbeat performs its own strict authentication +
   * BirdShop-session validation.
   */

  const isHeartbeatRoute =
    pathname ===
      "/admin/session/heartbeat";

  /* =======================================================
     PUBLIC / SPECIAL ADMIN ROUTES
  ======================================================= */

  if (
    !isAdminRoute ||
    isLoginRoute ||
    isLogoutRoute ||
    isHeartbeatRoute
  ) {
    return supabaseResponse;
  }

  /* =======================================================
     1. SUPABASE AUTHENTICATION

     The person must still have a valid Supabase login.
  ======================================================= */

  const {
    data:
      claimsData,

    error:
      claimsError,
  } =
    await supabase.auth
      .getClaims();

  const userId =
    claimsData
      ?.claims
      ?.sub;

  if (
    claimsError ||
    !userId
  ) {
    return redirectToLogin({
      request,

      supabaseResponse,
    });
  }

  /* =======================================================
     2. BIRDSHOP BROWSER-SESSION GATE

     This is deliberately separate from Supabase.

     An old Supabase login alone is NOT enough to enter
     BirdShop Administration.
  ======================================================= */

  const adminSession =
    request.cookies
      .get(
        ADMIN_SESSION_COOKIE
      )
      ?.value;

  const rawLastActive =
    request.cookies
      .get(
        ADMIN_ACTIVITY_COOKIE
      )
      ?.value;

  if (
    !adminSession ||
    !rawLastActive
  ) {
    /*
     * A Supabase session survived but the BirdShop browser
     * session did not.
     *
     * Clear Supabase authentication too so the user must
     * provide credentials again.
     */

    try {
      await supabase.auth
        .signOut();
    } catch {
      /*
       * The missing BirdShop session is already enough to
       * deny access, even if signOut itself fails.
       */
    }

    return redirectToLogin({
      request,

      supabaseResponse,

      reason:
        "session",
    });
  }

  /* =======================================================
     3. SERVER-SIDE IDLE TIMEOUT
  ======================================================= */

  const lastActive =
    Number(
      rawLastActive
    );

  if (
    !Number.isFinite(
      lastActive
    )
  ) {
    try {
      await supabase.auth
        .signOut();
    } catch {
      // Access is still denied.
    }

    return redirectToLogin({
      request,

      supabaseResponse,

      reason:
        "session",
    });
  }

  const idleFor =
    Date.now() -
    lastActive;

  if (
    idleFor >=
    ADMIN_IDLE_TIMEOUT_MS
  ) {
    /*
     * This is authoritative.
     *
     * A client cannot revive an already-expired admin
     * session by refreshing or sending a late heartbeat.
     */

    try {
      await supabase.auth
        .signOut();
    } catch {
      // Access remains denied.
    }

    return redirectToLogin({
      request,

      supabaseResponse,

      reason:
        "inactive",
    });
  }

  /* =======================================================
     4. ACTIVE BIRDSHOP STAFF ACCOUNT
  ======================================================= */

  const {
    data:
      profileData,

    error:
      profileError,
  } =
    await supabase.rpc(
      "birdshop_get_my_staff_profile"
    );

  if (
    profileError ||
    !profileData
  ) {
    try {
      await supabase.auth
        .signOut();
    } catch {
      // Access remains denied.
    }

    return redirectToLogin({
      request,

      supabaseResponse,

      reason:
        "session",
    });
  }

  const profile =
    profileData as
      StaffProfile;

  if (
    profile.user_id !==
      userId ||
    profile.is_active !==
      true ||
    ![
      "owner",
      "service_agent",
    ].includes(
      profile.role
    )
  ) {
    try {
      await supabase.auth
        .signOut();
    } catch {
      // Access remains denied.
    }

    return redirectToLogin({
      request,

      supabaseResponse,

      reason:
        "session",
    });
  }

  /* =======================================================
     5. OWNER

     Full administration remains available.
  ======================================================= */

  if (
    profile.role ===
    "owner"
  ) {
    return supabaseResponse;
  }

  /* =======================================================
     6. SERVICE AGENT

     Service Agents are restricted to the Service Desk.
  ======================================================= */

  if (
    profile.role ===
    "service_agent"
  ) {
    const isServiceChat =
      pathname ===
      "/admin/chat";

    /* =====================================================
       BLOCK ALL OTHER ADMIN ROUTES
    ===================================================== */

    if (
      !isServiceChat
    ) {
      const serviceParams =
        new URLSearchParams();

      serviceParams.set(
        "view",
        "active"
      );

      serviceParams.set(
        "type",
        "service"
      );

      return redirectWithSupabaseCookies({
        request,

        supabaseResponse,

        pathname:
          "/admin/chat",

        searchParams:
          serviceParams,
      });
    }

    /* =====================================================
       FORCE SAFE SERVICE CHAT URL

       These are NOT allowed for Service Agent:

         ?type=product
         ?type=general
         ?view=closed
         ?view=deleted

       Only:

         view=active
         type=service

       A conversation ID may be preserved. Database RLS/RPC
       rules still determine whether that specific service
       belongs to the employee.
    ===================================================== */

    const safeParams =
      new URLSearchParams();

    safeParams.set(
      "view",
      "active"
    );

    safeParams.set(
      "type",
      "service"
    );

    const conversationId =
      request.nextUrl
        .searchParams
        .get(
          "conversation"
        );

    if (
      conversationId
    ) {
      safeParams.set(
        "conversation",
        conversationId
      );
    }

    const currentParams =
      request.nextUrl
        .searchParams
        .toString();

    const requiredParams =
      safeParams
        .toString();

    if (
      currentParams !==
      requiredParams
    ) {
      return redirectWithSupabaseCookies({
        request,

        supabaseResponse,

        pathname:
          "/admin/chat",

        searchParams:
          safeParams,
      });
    }

    return supabaseResponse;
  }

  /* =======================================================
     7. FAIL CLOSED

     Any unknown future role gets no Admin access.
  ======================================================= */

  return redirectToLogin({
    request,

    supabaseResponse,

    reason:
      "session",
  });
}