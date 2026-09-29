import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

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
   HELPERS
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

  /*
   * Supabase may have refreshed authentication cookies
   * earlier in this same request.
   *
   * Preserve them on the redirect response.
   */

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
   SESSION / ADMIN PROXY
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
             * Keep the incoming request cookies synchronized
             * with any authentication refresh.
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

            supabaseResponse =
              NextResponse.next({
                request,
              });

            /*
             * Also send refreshed cookies back to browser.
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
     ROUTE
  ======================================================= */

  const pathname =
    request.nextUrl.pathname;

  const isAdminRoute =
    pathname ===
      "/admin" ||
    pathname.startsWith(
      "/admin/"
    );

  const isLoginPage =
    pathname ===
    "/admin/login";

  const isLogoutRoute =
    pathname ===
    "/admin/logout";

  /*
   * Public pages never need BirdShop admin authorization.
   *
   * Login and logout need to remain reachable so authentication
   * itself can function.
   */

  if (
    !isAdminRoute ||
    isLoginPage ||
    isLogoutRoute
  ) {
    return supabaseResponse;
  }

  /* =======================================================
     AUTHENTICATION
  ======================================================= */

  const {
    data:
      claimsData,

    error:
      claimsError,
  } =
    await supabase
      .auth
      .getClaims();

  const userId =
    claimsData
      ?.claims
      ?.sub;

  if (
    claimsError ||
    !userId
  ) {
    return redirectWithSupabaseCookies({
      request,

      supabaseResponse,

      pathname:
        "/admin/login",
    });
  }

  /* =======================================================
     BIRDSHOP STAFF PROFILE

     This is intentionally retrieved through our protected
     SECURITY DEFINER function instead of reading admin_users
     directly.

     It gives us one authoritative answer for:

       - owner
       - service_agent
       - active / disabled
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
    return redirectWithSupabaseCookies({
      request,

      supabaseResponse,

      pathname:
        "/admin/login",
    });
  }

  const profile =
    profileData as
      StaffProfile;

  /* =======================================================
     PROFILE VALIDATION
  ======================================================= */

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
    return redirectWithSupabaseCookies({
      request,

      supabaseResponse,

      pathname:
        "/admin/login",
    });
  }

  /* =======================================================
     OWNER

     Owner keeps full access to the existing administration
     panel.
  ======================================================= */

  if (
    profile.role ===
    "owner"
  ) {
    return supabaseResponse;
  }

  /* =======================================================
     SERVICE AGENT

     Service Agents may access ONE administration page:

       /admin/chat

     Everything else under /admin is blocked.
  ======================================================= */

  if (
    profile.role ===
    "service_agent"
  ) {
    const isServiceChat =
      pathname ===
      "/admin/chat";

    /*
     * Trying any other admin page sends the employee back
     * to the restricted Service Desk.
     */

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
       CANONICAL SERVICE-ONLY CHAT URL

       Even if someone manually enters:

       /admin/chat?type=product
       /admin/chat?type=general
       /admin/chat?view=deleted

       the URL is rewritten to the only workspace the
       Service Agent is allowed to use.

       We preserve a conversation ID only so clicking between
       approved service conversations continues to work.
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
      request
        .nextUrl
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
      request
        .nextUrl
        .searchParams
        .toString();

    const targetParams =
      safeParams
        .toString();

    if (
      currentParams !==
      targetParams
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
     FAIL CLOSED

     Unknown future role = no administration access.
  ======================================================= */

  return redirectWithSupabaseCookies({
    request,

    supabaseResponse,

    pathname:
      "/admin/login",
  });
}