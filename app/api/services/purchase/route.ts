import { assertSameOrigin, isUuid, readBody, privateHeaders, publicErrorResponse, PublicError } from "@/lib/server-config";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import { serverRpc, startCheckout, type CheckoutAttempt } from "@/lib/payment-service";
import { orderToken, tokenHash } from "@/lib/order-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { paidServiceChat } from "@/lib/package-checkout";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "package-purchase", 10, 1800);
    const b = JSON.parse(await readBody(request, 8192));
    const name = String(b.name ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!Number.isSafeInteger(b.expectedCents) || !isUuid(b.requestId) ||
        !["starter", "standard", "premium"].includes(b.tier) ||
        typeof b.slug !== "string" || b.slug.length > 100 || name.length < 2 ||
        name.length > 100 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new PublicError("Enter your name and a valid email.", 400);
    }
    await rateLimit("package-purchase-email", email, 8, 1800);
    const db = createAdminClient();
    // Preserve historical purchase identities across this upgrade.
    const { data: old, error: oldError } = await db.from("birdshop_service_purchases")
      .select("fingerprint,payment_request_id").eq("request_id", b.requestId).maybeSingle();
    if (oldError) throw new Error("Purchase lookup failed");
    if (old) {
      const f = old.fingerprint;
      if (f.slug !== b.slug || f.tier !== b.tier || f.name !== name ||
          f.email !== email || Number(f.cents) !== b.expectedCents) throw new Error("Purchase mismatch");
      const { data: payment, error } = await db.from("service_payment_requests")
        .select("order_id").eq("id", old.payment_request_id).single();
      if (error) throw new Error("Payment lookup failed");
      const chat = await paidServiceChat(payment.order_id);
      if (chat) return Response.json({ url: `/service-chat?token=${encodeURIComponent(chat)}`, completed: true }, { headers: privateHeaders });
      throw new PublicError("This purchase began before the update. Use its existing Stripe checkout, or contact BirdShop to confirm its status before purchasing again.", 409);
    }
    const token = orderToken(b.requestId);
    const attempt = await serverRpc<CheckoutAttempt>("birdshop_begin_package_checkout", {
      p_request_id: b.requestId, p_slug: b.slug, p_tier: b.tier,
      p_name: name, p_email: email, p_expected_cents: b.expectedCents,
      p_access_hash: tokenHash(token),
    });
    const statusUrl = `/services/checkout?token=${token}`;
    if (attempt.order_id) return Response.json({ url: statusUrl, completed: true }, { headers: privateHeaders });
    if (["paid", "processing", "attention", "expired", "cancelled", "failed"].includes(attempt.status)) {
      return Response.json({ url: statusUrl }, { headers: privateHeaders });
    }
    try {
      const url = await startCheckout(attempt);
      return Response.json({ url: url || statusUrl }, { headers: privateHeaders });
    } catch {
      // Show a payment-only recovery page; never reveal an unpaid chat.
      return Response.json({ url: statusUrl }, { headers: privateHeaders });
    }
  } catch (error) {
    return publicErrorResponse(error, "Checkout could not start. Refresh the package and retry; no unpaid chat has been opened.", 400);
  }
}
