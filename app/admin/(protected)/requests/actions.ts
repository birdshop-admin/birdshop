"use server";
import { requireOwner } from "@/lib/staff-auth";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/* =========================================================
   AUTH
========================================================= */

async function requireAdmin() {
  return (await requireOwner()).supabase;
}

async function getRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const { data, error } = await supabase
    .from("support_requests")
    .select("id, topic, status, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to find that support request.");
  }

  if (data.topic !== "product" && data.topic !== "general") {
    throw new Error("Service work belongs in Orders.");
  }

  return data;
}

function refreshSupport() {
  revalidatePath("/admin/requests");

  revalidatePath("/admin");
}

/* =========================================================
   ASSIGN
========================================================= */

export async function assignRequestAdmin(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();

  const assignedTo = String(formData.get("assigned_to") ?? "").trim();

  if (!id) {
    throw new Error("Request ID is required.");
  }

  if (assignedTo.length < 2 || assignedTo.length > 80) {
    throw new Error("Enter an admin name between 2 and 80 characters.");
  }

  const request = await getRequest(supabase, id);

  if (request.deleted_at) {
    throw new Error("Restore this request before editing it.");
  }

  if (request.status === "resolved" || request.status === "closed") {
    throw new Error("Reopen this request before assigning it.");
  }

  const { error } = await supabase
    .from("support_requests")
    .update({
      assigned_to: assignedTo,

      assigned_at: new Date().toISOString(),

      status: request.status === "open" ? "in_progress" : request.status,
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      `Unable to assign request: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  refreshSupport();
}

/* =========================================================
   STATUS
========================================================= */

export async function setRequestStatus(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();

  const status = String(formData.get("status") ?? "").trim();

  if (!id || !["open", "in_progress", "resolved", "closed"].includes(status)) {
    throw new Error("Invalid support request update.");
  }

  const request = await getRequest(supabase, id);

  if (request.deleted_at) {
    throw new Error("Restore this request before changing its status.");
  }

  const update =
    status === "open"
      ? {
          status,
          assigned_to: null,
          assigned_at: null,
        }
      : {
          status,
        };

  const { error } = await supabase
    .from("support_requests")
    .update(update)
    .eq("id", id);

  if (error) {
    throw new Error(
      `Unable to update request: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  refreshSupport();
}

/* =========================================================
   MOVE TO DELETED
========================================================= */

export async function softDeleteRequest(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Request ID is required.");
  }

  await getRequest(supabase, id);

  const { error } = await supabase
    .from("support_requests")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      `Unable to delete request: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  refreshSupport();
}

/* =========================================================
   RESTORE
========================================================= */

export async function restoreRequest(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Request ID is required.");
  }

  await getRequest(supabase, id);

  const { error } = await supabase
    .from("support_requests")
    .update({
      deleted_at: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(
      `Unable to restore request: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  refreshSupport();
}

/* =========================================================
   PERMANENT DELETE
========================================================= */

export async function permanentlyDeleteRequest(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Request ID is required.");
  }

  const { error } = await supabase.rpc(
    "birdshop_permanently_delete_support_request",
    {
      p_request_id: id,
    },
  );

  if (error) {
    throw new Error(
      `Unable to permanently delete request: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
    );
  }

  refreshSupport();
}
