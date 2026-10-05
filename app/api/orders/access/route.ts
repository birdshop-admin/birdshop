import { publicErrorResponse } from "@/lib/server-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateHeaders } from "@/lib/server-config";
import { tokenHash } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error();
    await rateLimit("order-status", token, 30, 60);
    const db = createAdminClient();
    const { data: attempt, error } = await db
      .from("birdshop_checkout_attempts")
      .select("order_id,kind")
      .eq("access_hash", tokenHash(token))
      .single();
    if (error || attempt.kind !== "product" || !attempt.order_id)
      throw new Error();
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
    if (orderError || itemError || !order.paid_at) throw new Error();
    return Response.json({ order, items }, { headers: privateHeaders });
  } catch (error) {
    return publicErrorResponse(
      error,
      "This private order link is unavailable. Check your email or contact BirdShop.",
      404,
    );
  }
}
