import {
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

export async function POST() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 401,
      }
    );
  }

  const {
    data: admin,
  } =
    await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 403,
      }
    );
  }

  const cookieStore =
    await cookies();

  cookieStore.set(
    ADMIN_ACTIVITY_COOKIE,
    String(Date.now()),
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/admin",
      maxAge:
        60 * 60 * 24,
    }
  );

  return NextResponse.json({
    ok: true,
  });
}
