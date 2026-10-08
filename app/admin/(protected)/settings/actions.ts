"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/staff-auth";
import { runMaintenance } from "@/lib/maintenance";
import { recoverCheckoutAttempt } from "@/lib/maintenance";
import type { CheckoutAttempt } from "@/lib/payment-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/server-config";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { drainEmailJobs } from "@/lib/email-jobs";
export async function retryBackgroundWork() {
  const { user } = await requireOwner();
  const audit = await createAdminClient()
    .from("birdshop_audit_log")
    .insert({ actor_id: user.id, action: "manual_background_recovery" });
  if (audit.error) throw new Error("Could not record recovery action.");
  await runMaintenance();
  revalidatePath("/admin/settings");
}

export async function resendReviewedEmail(form: FormData) {
  const { user } = await requireOwner();
  const id = String(form.get("jobId") ?? "");
  if (!isUuid(id) || form.get("reviewed") !== "yes")
    redirect(
      "/admin/settings?notice=Check%20provider%20delivery%20history%20before%20resending.",
    );
  const db = createAdminClient();
  const { data: job, error } = await db
    .from("birdshop_email_jobs")
    .select("kind,entity_id,payload")
    .eq("id", id)
    .eq("status", "attention")
    .single();
  if (error || !job)
    redirect(
      "/admin/settings?notice=This%20email%20job%20is%20not%20awaiting%20manual%20review.",
    );
  if (job.kind === "product_delivery") {
    const { serverRpc } = await import("@/lib/payment-service");
    await serverRpc("birdshop_v2_requeue_product_delivery", {
      p_order_id: job.entity_id,
      p_actor_id: user.id,
      p_reviewed: true,
    });
    revalidatePath("/admin/settings");
    redirect(
      "/admin/settings?notice=Delivery%20requeued%20with%20the%20same%20assigned%20codes.",
    );
  }
  const queued = await db.from("birdshop_email_jobs").upsert(
    {
      dedupe_key: `manual/${id}`,
      kind: job.kind,
      entity_id: job.entity_id,
      // Re-render from current records: a cached envelope may still carry a private
      // chat link for a conversation that has since been removed.
      payload: null,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  if (queued.error)
    throw new Error("The replacement email could not be queued.");
  await db.from("birdshop_audit_log").insert({
    actor_id: user.id,
    action: "email_resend_requested",
    entity_id: id,
  });
  after(async () => {
    await drainEmailJobs(3).catch(() => undefined);
  });
  revalidatePath("/admin/settings");
  redirect(
    "/admin/settings?notice=A%20replacement%20email%20is%20queued.%20Repeated%20clicks%20will%20not%20create%20extra%20jobs.",
  );
}

export async function reconcileSavedCheckout(form: FormData) {
  const { user } = await requireOwner();
  const id = String(form.get("attemptId") ?? "");
  const sessionId = String(form.get("sessionId") ?? "").trim();
  let message = "Checkout reconciled with Stripe.";
  try {
    if (!isUuid(id) || (sessionId && !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)))
      throw new Error("Choose a checkout and a valid Stripe session ID.");
    const db = createAdminClient();
    const { data, error } = await db
      .from("birdshop_checkout_attempts")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) throw new Error("Checkout was not found.");
    await recoverCheckoutAttempt(
      data as CheckoutAttempt,
      sessionId || undefined,
    );
    const audit = await db.from("birdshop_audit_log").insert({
      actor_id: user.id,
      action: "checkout_reconciled",
      entity_id: id,
    });
    if (audit.error)
      throw new Error(
        "Checkout reconciled, but the audit record could not be written.",
      );
  } catch {
    message =
      "Reconciliation did not finish. Verify the matching Stripe session and retry.";
  }
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?notice=${encodeURIComponent(message)}`);
}

// Moved from the former Orders page: re-checks code allocation for a paid
// digital order and queues its delivery email again.
export async function retryProductDelivery(form: FormData) {
  const { user } = await requireOwner();
  const id = String(form.get("orderId") ?? "");
  if (!isUuid(id))
    redirect("/admin/settings?notice=" + encodeURIComponent("Invalid order. Refresh and retry.") + "#deliveries");
  const { serverRpc } = await import("@/lib/payment-service");
  let message = "Allocation checked and delivery queued. Check the delivery status below.";
  try {
    await serverRpc("birdshop_v2_requeue_product_delivery", {
      p_order_id: id,
      p_actor_id: user.id,
      p_reviewed: form.get("reviewed") === "yes",
    });
    await drainEmailJobs(2);
  } catch {
    message =
      "Delivery needs review. Add stock if needed, or check provider history before confirming a resend.";
  }
  revalidatePath("/admin/settings");
  redirect("/admin/settings?notice=" + encodeURIComponent(message) + "#deliveries");
}
