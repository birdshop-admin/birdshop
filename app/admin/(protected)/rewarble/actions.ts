"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function reviewRewarbleRequest(form: FormData) {
  const { user } = await requireOwner();
  const id = String(form.get("id") ?? "");
  const from = String(form.get("from") ?? "");
  const status = String(form.get("status") ?? "");
  const note = String(form.get("note") ?? "").trim();

  if (!/^[a-f0-9-]{36}$/i.test(id) ||
      !((from === "pending_review" && ["redeemed","rejected"].includes(status)) ||
        (from === "redeemed" && status === "fulfilled")) ||
      note.length > 500) throw new Error("Invalid Rewarble review transition.");

  // "redeemed" is a manual assertion that voucher value was actually received.
  // It NEVER calls the Stripe order settlement or inventory delivery functions.
  const { error } = await createAdminClient().rpc("birdshop_review_rewarble_request", {
    p_id: id, p_from: from, p_to: status,
    p_owner: user.id, p_note: note,
  });
  if (error) throw new Error("Review was not saved; refresh and try again.");
  revalidatePath("/admin/rewarble");
  revalidatePath("/admin/rewarble/" + id);
}
