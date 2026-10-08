import {
  assertSameOrigin,
  isUuid,
  privateHeaders,
  PublicError,
  publicErrorResponse,
  readBody,
} from "@/lib/server-config";

import { orderToken, tokenHash } from "@/lib/order-access";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  serverRpc,
  startCheckout,
  type CheckoutAttempt,
} from "@/lib/payment-service";

export const maxDuration = 60;

const MAX_UNITS_PER_CHECKOUT = 10;
const MAX_OPEN_CHECKOUTS_PER_EMAIL = 2;

export async function POST(request: Request) {
  // True only once the database has confirmed this attempt id does not exist yet.
  // Only then can a failure tell the browser to forget it: anything else (a stored
  // attempt, a lost response, a timeout) must stay recoverable.
  let knownUnrecorded = false;

  try {
    assertSameOrigin(request);

    const body = JSON.parse(await readBody(request));

    if (!isUuid(body.attemptId)) {
      throw new PublicError("Enter a valid email and cart.", 400);
    }

    const { data: existing, error: existingError } = await createAdminClient()
      .from("birdshop_checkout_attempts")
      .select("id,kind")
      .eq("id", body.attemptId)
      .maybeSingle();

    if (existingError) throw new Error("Checkout lookup failed.");

    if (existing && existing.kind !== "product") {
      throw new PublicError("This checkout cannot be resumed here.", 409);
    }

    knownUnrecorded = !existing;

    // Reject an oversized new cart before it uses up the customer's rate limits.
    if (!existing && Array.isArray(body.items)) {
      const requestedUnits = body.items.reduce(
        (sum: number, item: { quantity?: unknown }) =>
          sum + (Number.isInteger(item?.quantity) ? Number(item.quantity) : 0),
        0,
      );

      if (requestedUnits > MAX_UNITS_PER_CHECKOUT) {
        throw new PublicError(
          `Checkout supports up to ${MAX_UNITS_PER_CHECKOUT} codes per order. Reduce quantities and retry.`,
          400,
        );
      }
    }

    await limitRequest(request, "product-checkout", 6, 1800);

    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();

    if (
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.items.length > 20 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 320
    ) {
      throw new PublicError("Enter a valid email and cart.", 400);
    }

    await rateLimit("product-checkout-email", email, 5, 1800);

    const slugs: string[] = body.items.map((item: { slug?: unknown }) =>
      typeof item.slug === "string" ? item.slug : "",
    );

    // A stored attempt keeps its agreed items even if one was hidden afterwards.
    const productQuery = createAdminClient()
      .from("products")
      .select("id,slug")
      .in("slug", slugs);

    const { data: products, error } = await (existing
      ? productQuery
      : productQuery.eq("is_visible", true));

    if (error || products?.length !== slugs.length) {
      throw new PublicError("An item is unavailable. Refresh your cart.", 409);
    }

    const cart = body.items.map(
      (item: { slug: string; quantity: unknown }) => ({
        id: products.find((product) => product.slug === item.slug)?.id,
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
    ) {
      throw new PublicError("Choose 1–10 of each item.", 400);
    }

    // Codes are reserved before payment; cap what one unpaid checkout can hold.
    const units = cart.reduce(
      (sum: number, item: { quantity: unknown }) => sum + Number(item.quantity),
      0,
    );

    if (!existing && units > MAX_UNITS_PER_CHECKOUT) {
      throw new PublicError(
        `Checkout supports up to ${MAX_UNITS_PER_CHECKOUT} codes per order. Reduce quantities and retry.`,
        400,
      );
    }

    // A retry of a stored attempt is always allowed; new attempts are limited
    // while this email already holds unpaid reservations.
    if (!existing) {
      // Only holds that are still live count; expired ones are released by maintenance.
      const { data: holds, error: openError } = await createAdminClient()
        .from("birdshop_checkout_attempts")
        .select("expires_at")
        .eq("kind", "product")
        .eq("customer_email", email)
        .in("status", ["creating", "open"])
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(MAX_OPEN_CHECKOUTS_PER_EMAIL);

      if (openError) throw new Error("Open checkout lookup failed.");

      if ((holds?.length ?? 0) >= MAX_OPEN_CHECKOUTS_PER_EMAIL) {
        const minutes = Math.max(
          1,
          Math.ceil(
            (new Date(holds![0].expires_at).getTime() - Date.now()) / 60000,
          ),
        );

        throw new PublicError(
          `This email already has ${MAX_OPEN_CHECKOUTS_PER_EMAIL} unpaid checkouts holding stock. Complete one in the tab where you started it, or try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
          409,
        );
      }
    }

    const attempt = await serverRpc<CheckoutAttempt>(
      "birdshop_v2_begin_product_checkout",
      {
        p_id: body.attemptId,
        p_access_hash: tokenHash(orderToken(body.attemptId)),
        p_cart: cart,
        p_email: email,
        p_name: String(body.name ?? "").trim(),
      },
      [
        /^Not enough stock for .{1,200}\. Your cart has not been charged\.$/,
        /^An item is unavailable for automatic delivery\. Contact BirdShop for help\.$/,
        /^Choose between 1 and 10 of each item\.$/,
        /^Cart total is outside the supported range\.$/,
      ],
    );

    knownUnrecorded = false;

    if (["expired", "failed", "cancelled"].includes(attempt.status)) {
      return Response.json(
        {
          error:
            "This checkout expired. Start again to check current stock and prices.",
          resetAttempt: true,
        },
        { status: 409, headers: privateHeaders },
      );
    }

    if (attempt.order_id) {
      const returnToken = orderToken(attempt.id);

      return Response.json(
        {
          url: `/orders/access?token=${returnToken}`,
          returnToken,
        },
        { headers: privateHeaders },
      );
    }

    const url = await startCheckout(attempt);

    if (!url) {
      return Response.json(
        {
          error: "The previous checkout expired. Please try again.",
          resetAttempt: true,
        },
        { status: 409, headers: privateHeaders },
      );
    }

    return Response.json(
      {
        url,
        returnToken: orderToken(attempt.id),
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    const response = publicErrorResponse(
      error,
      "Checkout could not start. Check your cart, stock, and email, then retry.",
      409,
    );

    // Only explicit business errors raised before (or rolled back with) the insert
    // prove nothing was reserved. Rate limits, outages and timeouts stay recoverable.
    if (
      !knownUnrecorded ||
      !(error instanceof PublicError) ||
      error.status === 429 ||
      error.status >= 500
    )
      return response;

    const body = (await response.json()) as { error: string };

    return Response.json(
      { ...body, resetAttempt: true },
      { status: response.status, headers: response.headers },
    );
  }
}