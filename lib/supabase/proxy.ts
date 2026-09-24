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
} from "@/lib/admin-session";

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,

      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,

      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value
                );
              }
            );

            supabaseResponse =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                supabaseResponse.cookies.set(
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

  if (
    !isAdminRoute ||
    isLoginPage ||
    isLogoutRoute
  ) {
    return supabaseResponse;
  }

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
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      "/admin/login";

    loginUrl.search =
      "";

    return NextResponse.redirect(
      loginUrl
    );
  }

  const {
    data:
      adminUser,

    error:
      adminError,
  } =
    await supabase
      .from(
        "admin_users"
      )
      .select(
        "user_id, role"
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  if (
    adminError ||
    !adminUser
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      "/admin/login";

    loginUrl.search =
      "";

    return NextResponse.redirect(
      loginUrl
    );
  }

  /*
   * Heartbeat requests update the
   * activity cookie themselves.
   */
  if (
    pathname ===
    "/admin/session/heartbeat"
  ) {
    return supabaseResponse;
  }

  const rawLastActive =
    request.cookies.get(
      ADMIN_ACTIVITY_COOKIE
    )?.value;

  const lastActive =
    Number(
      rawLastActive
    );

  if (
    rawLastActive &&
    Number.isFinite(
      lastActive
    ) &&
    Date.now() -
      lastActive >=
      ADMIN_IDLE_TIMEOUT_MS
  ) {
    const logoutUrl =
      request.nextUrl.clone();

    logoutUrl.pathname =
      "/admin/logout";

    logoutUrl.search =
      "?reason=inactive";

    return NextResponse.redirect(
      logoutUrl
    );
  }

  /*
   * First protected request after
   * login establishes activity.
   */
  if (
    !rawLastActive ||
    !Number.isFinite(
      lastActive
    )
  ) {
    supabaseResponse.cookies.set(
      ADMIN_ACTIVITY_COOKIE,
      String(
        Date.now()
      ),
      {
        httpOnly: true,

        sameSite:
          "lax",

        secure:
          process.env.NODE_ENV ===
          "production",

        path:
          "/admin",

        maxAge:
          60 *
          60 *
          24,
      }
    );
  }

  return supabaseResponse;
}