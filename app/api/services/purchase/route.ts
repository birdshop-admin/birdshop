import { after } from "next/server";
import {
  assertSameOrigin,
  isUuid,
  readBody,
  privateHeaders,
  publicErrorResponse,
  PublicError,
} from "@/lib/server-config";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import {
  serverRpc,
  startCheckout,
  type CheckoutAttempt,
} from "@/lib/payment-service";
import { rememberDeviceChat } from "@/lib/customer-device";
import { drainEmailJobs } from "@/lib/email-jobs";
import { createAdminClient } from "@/lib/supabase/admin";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "package-purchase", 10, 1800);
    const b = JSON.parse(await readBody(request, 8192));
    const name = String(b.name ?? "").trim(),
      email = String(b.email ?? "")
        .trim()
        .toLowerCase();
    if (
      !Number.isSafeInteger(b.expectedCents) ||
      !isUuid(b.requestId) ||
      !["starter", "standard", "premium"].includes(b.tier) ||
      typeof b.slug !== "string" ||
      b.slug.length > 100 ||
      name.length < 2 ||
      name.length > 100 ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      throw new PublicError("Enter your name and a valid email.", 400);
    await rateLimit("package-purchase-email", email, 8, 1800);
    const purchase = await serverRpc<{
      public_token: string;
      payment_request_id: string;
    }>("birdshop_buy_service_package", {
      p_request_id: b.requestId,
      p_slug: b.slug,
      p_tier: b.tier,
      p_name: name,
      p_email: email,
      p_expected_cents: b.expectedCents,
    });
    await rememberDeviceChat(purchase.public_token).catch(() => false);
    const chatUrl =
      "/service-chat?token=" + encodeURIComponent(purchase.public_token);
    after(async () => {
      await drainEmailJobs(2).catch(() => undefined);
    });
    const { data: payment, error } = await createAdminClient()
      .from("service_payment_requests")
      .select("status")
      .eq("id", purchase.payment_request_id)
      .single();
    if (error) throw Error("Payment lookup failed");
    if (payment.status === "paid")
      return Response.json({ url: chatUrl }, { headers: privateHeaders });
    try {
      for (let i = 0; i < 2; i++) {
        const attempt = await serverRpc<CheckoutAttempt>(
          "birdshop_v2_begin_service_checkout",
          {
            p_request_id: purchase.payment_request_id,
            p_token: purchase.public_token,
          },
        );
        const url = await startCheckout(attempt);
        if (url) return Response.json({ url }, { headers: privateHeaders });
      }
    } catch {
      /* Preserve private chat access if the external checkout provider is unavailable. */
    }
    return Response.json(
      {
        error:
          "Checkout could not open. Your private chat is ready; you can retry payment there.",
        chatUrl,
      },
      { status: 409, headers: privateHeaders },
    );
  } catch (error) {
    return publicErrorResponse(
      error,
      "This package could not be purchased. Refresh to check availability, then retry.",
      400,
    );
  }
}
