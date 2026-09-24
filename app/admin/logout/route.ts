import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  cookies,
} from "next/headers";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  ADMIN_ACTIVITY_COOKIE,
} from "@/lib/admin-session";

async function endSession() {
  const supabase =
    await createClient();

  await supabase.auth
    .signOut();

  const cookieStore =
    await cookies();

  cookieStore.set(
    ADMIN_ACTIVITY_COOKIE,
    "",
    {
      path:
        "/admin",

      maxAge:
        0,
    }
  );

  /*
   * Removes the legacy cookie from
   * the previous close-tab system.
   *
   * This is important because an old
   * value may still exist in your
   * browser right now.
   */
  cookieStore.set(
    "birdshop_admin_exit",
    "",
    {
      path:
        "/admin",

      maxAge:
        0,
    }
  );
}

function reasonFromRequest(
  request:
    NextRequest
) {
  const reason =
    request.nextUrl
      .searchParams
      .get(
        "reason"
      );

  if (
    reason ===
      "inactive" ||
    reason ===
      "closed"
  ) {
    return reason;
  }

  return null;
}

export async function POST(
  request:
    NextRequest
) {
  await endSession();

  return NextResponse.json({
    ok: true,

    reason:
      reasonFromRequest(
        request
      ),
  });
}

export async function GET(
  request:
    NextRequest
) {
  await endSession();

  const loginUrl =
    new URL(
      "/admin/login",
      request.url
    );

  const reason =
    reasonFromRequest(
      request
    );

  if (
    reason
  ) {
    loginUrl.searchParams.set(
      "reason",
      reason
    );
  }

  return NextResponse.redirect(
    loginUrl
  );
}