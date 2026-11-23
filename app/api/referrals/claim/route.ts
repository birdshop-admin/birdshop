import { assertSameOrigin, privateHeaders, PublicError, publicErrorResponse, readBody } from "@/lib/server-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenHash } from "@/lib/order-access";
import { limitRequest, rateLimit } from "@/lib/rate-limit";

const NOT_AVAILABLE = "This referral claim cannot be completed for this order.";
const known = new Map<string, string>([
  ["Invalid referral code", "Enter a valid referral code."],
  ["Invalid or ineligible referral code", "That referral code cannot be used."],
  ["This purchase already has a different referral", "This purchase has already been attributed to a referrer."],
  ["This purchase already has a referral", "This purchase has already been attributed to a referrer."],
  ["Only a first paid purchase can be referred", "Referral rewards are limited to your first paid BirdShop purchase."],
  ["This customer already received referral credit", "A referral has already been recorded for this customer."],
  ["The referral claim window has expired", "Referral codes must be claimed within seven days of payment."],
  ["This order is not eligible for referral credit", "This order is not eligible for referral credit."],
]);

export async function POST(request: Request) {
  try {
    if (process.env.BIRDSHOP_POSTPURCHASE_REFERRALS_ENABLED !== "true")
      throw new PublicError("Referral code claims are not available yet.", 503);
    assertSameOrigin(request);
    await limitRequest(request, "postpurchase-referral-ip", 12, 3600);

    const body = JSON.parse(await readBody(request, 2048));
    const token = typeof body.token === "string" ? body.token : "";
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new PublicError(NOT_AVAILABLE, 404);
    if (!/^[A-Z0-9]{6,20}$/.test(code))
      throw new PublicError("Enter a valid referral code.", 400);

    // The private delivery link is the customer's order authorization.
    // No order IDs or customer emails may be supplied by the browser.
    await rateLimit("postpurchase-referral-order", tokenHash(token), 5, 3600);
    const db = createAdminClient();
    const { data: attempt, error: lookupError } = await db
      .from("birdshop_checkout_attempts")
      .select("order_id,kind")
      .eq("access_hash", tokenHash(token))
      .maybeSingle();
    if (lookupError) throw new Error("Referral order lookup failed.");
    if (!attempt || attempt.kind !== "product" || !attempt.order_id)
      throw new PublicError(NOT_AVAILABLE, 404);

    // Database RPC enforces paid/fulfilled/refunded/test status, unique first-buyer
    // eligibility, seven-day window, self-referral and atomic claiming.
    const { data, error } = await db.rpc("birdshop_claim_postpurchase_referral", {
      p_order_id: attempt.order_id,
      p_code: code,
    });
    if (error) {
      const safe = known.get(error.message);
      if (safe) throw new PublicError(safe, 409);
      console.error("BirdShop referral claim unavailable", { code: error.code });
      throw new Error("Referral verification is unavailable.");
    }
    if (data !== "verified" && data !== "already_recorded")
      throw new Error("Unexpected referral claim result.");
    return Response.json(
      { status: data, message: data === "verified"
        ? "Your friend has been credited as a verified referred buyer. Their reward remains pending until fulfillment and review."
        : "This referral was already recorded for your purchase." },
      { headers: privateHeaders },
    );
  } catch (error) {
    return publicErrorResponse(error, "Referral verification is temporarily unavailable.", 503);
  }
}
