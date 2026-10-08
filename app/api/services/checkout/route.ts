import { after } from "next/server";
import { assertSameOrigin, privateHeaders, publicErrorResponse, readBody } from "@/lib/server-config";
import { rateLimit } from "@/lib/rate-limit";
import { readPackageAttempt, paidServiceChat } from "@/lib/package-checkout";
import { recoverCheckoutAttempt } from "@/lib/maintenance";
import { startCheckout } from "@/lib/payment-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { rememberDeviceChat } from "@/lib/customer-device";
import { drainEmailJobs } from "@/lib/email-jobs";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { token, action = "check" } = JSON.parse(await readBody(request, 4096));
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) ||
        !["check", "resume", "cancel"].includes(action)) throw new Error("Unavailable");
    await rateLimit("package-checkout-status", token, 30, 60);
    let a = await readPackageAttempt(token);
    const ended = () => Boolean(a.order_id) || ["paid", "expired", "cancelled", "failed"].includes(a.status);
    if (action === "cancel" && !ended()) {
      const { error } = await createAdminClient().from("birdshop_checkout_attempts")
        .update({ cancel_requested_at: new Date().toISOString(), next_check_at: new Date().toISOString() })
        .eq("id", a.id).in("status", ["creating", "open", "processing", "attention"]);
      if (error) throw new Error("Cancellation unavailable");
      a = await readPackageAttempt(token);
    }
    if (!ended() && (a.stripe_session_id || a.cancel_requested_at)) {
      await recoverCheckoutAttempt(a);
      a = await readPackageAttempt(token);
    }
    let url: string | null = null;
    if (action === "resume" && !ended() && !a.cancel_requested_at && ["creating", "open"].includes(a.status)) {
      url = await startCheckout(a);
      a = await readPackageAttempt(token);
    }
    if (ended() || a.cancel_requested_at) url = null;
    const chatToken = await paidServiceChat(a.order_id);
    if (chatToken) {
      await rememberDeviceChat(chatToken).catch(() => false);
      after(async () => { await drainEmailJobs(2).catch(() => undefined); });
    }
    return Response.json({
      status: a.status, cancelling: Boolean(a.cancel_requested_at) && !ended(),
      title: a.cart?.[0]?.name ?? "Service purchase",
      amount: Number(a.expected_cents) / 100, currency: a.currency,
      chatUrl: chatToken ? `/service-chat?token=${encodeURIComponent(chatToken)}` : null,
      url,
    }, { headers: privateHeaders });
  } catch (error) {
    return publicErrorResponse(error, "Payment status is temporarily unavailable. Please retry; your chat opens only after verified payment.", 409);
  }
}
