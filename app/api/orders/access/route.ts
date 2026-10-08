import { PublicError, publicErrorResponse } from "@/lib/server-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateHeaders } from "@/lib/server-config";
import { tokenHash } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";

const UNAVAILABLE =
  "This private order link is unavailable. Check your email or contact BirdShop.";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new PublicError(UNAVAILABLE, 404);
    await rateLimit("order-status", token, 30, 60);
    const db = createAdminClient();
    const { data: attempt, error } = await db
      .from("birdshop_checkout_attempts")
      .select("order_id,kind")
      .eq("access_hash", tokenHash(token))
      .maybeSingle();
    if (error) throw new Error("Order lookup failed.");
    // Unknown, non-product and unpaid links look identical to the browser.
    if (!attempt || attempt.kind !== "product" || !attempt.order_id)
      throw new PublicError(UNAVAILABLE, 404);
    const { data: order, error: orderError } = await db
      .from("orders")
      .select(
        "reference,total,currency,payment_status,refunded_amount,paid_at,fulfillment_status,delivery_status",
      )
      .eq("id", attempt.order_id)
      .single();
    const { data: items, error: itemError } = await db
      .from("order_items")
      .select(
        "product_name,quantity,platform:product_platform,region:product_region",
      )
      .eq("order_id", attempt.order_id);
    if (orderError || itemError) throw new Error("Order lookup failed.");
    if (!order.paid_at) throw new PublicError(UNAVAILABLE, 404);
    return Response.json({ order, items }, { headers: privateHeaders });
  } catch (error) {
    return publicErrorResponse(
      error,
      "Order status is temporarily unavailable. Please retry shortly.",
      503,
    );
  }
}
