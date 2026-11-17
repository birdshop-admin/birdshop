import "server-only";
import { redirect } from "next/navigation";
import { requireMarketplaceUser } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";
export async function requireOwner() {
  const user = await requireMarketplaceUser();
  const { data, error } = await createAdminClient().from("admin_users")
    .select("user_id,role,is_active").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Marketplace owner authorization is temporarily unavailable.");
  if (!data || data.role !== "owner" || !data.is_active) redirect("/sell?notice=owner-required");
  return { user, profile: data };
}
