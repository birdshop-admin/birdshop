import { PublicError, publicErrorResponse } from "@/lib/server-config";
import { tokenHash } from "@/lib/order-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateHeaders } from "@/lib/server-config";
import { rateLimit } from "@/lib/rate-limit";

const UNAVAILABLE =
  "Checkout is unavailable. Check your email or contact BirdShop.";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new PublicError(UNAVAILABLE, 404);
    await rateLimit("checkout-status", token, 30, 60);
    const db = createAdminClient();
    const { data, error } = await db
      .from("birdshop_checkout_attempts")
      .select("status,order_id,kind")
      .eq("access_hash", tokenHash(token))
      .maybeSingle();
    if (error) throw new Error("Checkout lookup failed.");
    if (!data || data.kind !== "product") throw new PublicError(UNAVAILABLE, 404);
    const orderToken = data.order_id ? token : null;
    return Response.json(
      { status: data.status, orderToken },
      { headers: privateHeaders },
    );
  } catch (error) {
    return publicErrorResponse(
      error,
      "Payment status is temporarily unavailable. Please retry shortly.",
      503,
    );
  }
}
