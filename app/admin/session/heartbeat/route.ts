import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { privateHeaders } from "@/lib/server-config";

export async function POST() {
  if (!(await cookies()).get(ADMIN_SESSION_COOKIE)?.value)
    return Response.json({ ok: false }, { status: 401 });
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return Response.json({ ok: false }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.rpc(
    "birdshop_get_my_staff_profile",
  );
  if (
    profileError ||
    !profile ||
    !profile.is_active ||
    profile.user_id !== user.id ||
    !["owner", "service_agent"].includes(profile.role)
  )
    return Response.json({ ok: false }, { status: 403 });
  return Response.json({ ok: true }, { headers: privateHeaders });
}
