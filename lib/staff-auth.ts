import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";

export type StaffProfile = {
  user_id: string;
  role: "owner" | "service_agent";
  display_name: string | null;
  is_active: boolean;
};

// Every server action checks this independently of the layout and proxy.
export async function requireStaff(ownerOnly = false) {
  if (!(await cookies()).get(ADMIN_SESSION_COOKIE)?.value)
    redirect("/admin/login?reason=session");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/admin/login");
  const { data, error: profileError } = await supabase.rpc(
    "birdshop_get_my_staff_profile",
  );
  const profile = data as StaffProfile | null;
  if (
    profileError ||
    !profile ||
    profile.user_id !== user.id ||
    !profile.is_active ||
    !["owner", "service_agent"].includes(profile.role)
  )
    redirect("/admin/login");
  if (ownerOnly && profile.role !== "owner")
    redirect("/admin/chat?view=active&type=service");
  return { supabase, user, profile };
}

export async function requireOwner() {
  return requireStaff(true);
}
