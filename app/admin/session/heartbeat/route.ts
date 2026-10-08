import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { privateHeaders } from "@/lib/server-config";

export async function POST() {
  if (!(await cookies()).get(ADMIN_SESSION_COOKIE)?.value)
    return Response.json({ ok: false }, { status: 401, headers: privateHeaders });
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error)
    return Response.json(
      { ok: false },
      {
        status:
          error.name === "AuthRetryableFetchError" ||
          Number(error.status) >= 500
            ? 503
            : 401,
        headers: privateHeaders,
      },
    );
  if (!user)
    return Response.json(
      { ok: false },
      { status: 401, headers: privateHeaders },
    );
  const { data: profile, error: profileError } = await supabase.rpc(
    "birdshop_get_my_staff_profile",
  );
  if (profileError)
    return Response.json(
      { ok: false },
      { status: 503, headers: privateHeaders },
    );
  if (
    !profile ||
    !profile.is_active ||
    profile.user_id !== user.id ||
    !["owner", "service_agent"].includes(profile.role)
  )
    return Response.json({ ok: false }, { status: 403, headers: privateHeaders });
  return Response.json({ ok: true }, { headers: privateHeaders });
}
