import { publicErrorResponse } from "@/lib/server-config";
import { orderToken, tokenHash } from "@/lib/order-access";
import { readBody } from "@/lib/server-config";
import { assertSameOrigin, isUuid, privateHeaders } from "@/lib/server-config";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  serverRpc,
  startCheckout,
  type CheckoutAttempt,
} from "@/lib/payment-service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "product-checkout", 6, 1800);
    const body = JSON.parse(await readBody(request));
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    if (
      !isUuid(body.attemptId) ||
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.items.length > 20 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 320
    )
      throw new Error("Enter a valid email and cart.");
    await rateLimit("product-checkout-email", email, 5, 1800);
    const slugs: string[] = body.items.map((item: { slug?: unknown }) =>
      typeof item.slug === "string" ? item.slug : "",
    );
    const { data: products, error } = await createAdminClient()
      .from("products")
      .select("id,slug")
      .in("slug", slugs)
      .eq("is_visible", true);
    if (error || products?.length !== slugs.length)
      throw new Error("An item is unavailable. Refresh your cart.");
    const cart = body.items.map(
      (item: { slug: string; quantity: unknown }) => ({
        id: products.find((p) => p.slug === item.slug)?.id,
        quantity: item.quantity,
      }),
    );
    if (
      cart.some(
        (item: { id?: string; quantity: unknown }) =>
          !item.id ||
          !Number.isInteger(item.quantity) ||
          Number(item.quantity) < 1 ||
          Number(item.quantity) > 10,
      )
    )
      throw new Error("Choose 1–10 of each item.");
    const attempt = await serverRpc<CheckoutAttempt>(
      "birdshop_v2_begin_product_checkout",
      {
        p_id: body.attemptId,
        p_access_hash: tokenHash(orderToken(body.attemptId)),
        p_cart: cart,
        p_email: email,
        p_name: String(body.name ?? "").trim(),
      },
    );
    if (["expired", "failed", "cancelled"].includes(attempt.status))
      return Response.json(
        {
          error:
            "This checkout expired. Start again to check current stock and prices.",
          resetAttempt: true,
        },
        { status: 409, headers: privateHeaders },
      );
    const url = await startCheckout(attempt);
    if (!url)
      return Response.json(
        {
          error: "The previous checkout expired. Please try again.",
          resetAttempt: true,
        },
        { status: 409, headers: privateHeaders },
      );
    return Response.json(
      { url, returnToken: orderToken(attempt.id) },
      { headers: privateHeaders },
    );
  } catch (error) {
    return publicErrorResponse(
      error,
      "Checkout could not start. Check your cart, stock, and email, then retry.",
      409,
    );
  }
}

export const maxDuration = 60;
