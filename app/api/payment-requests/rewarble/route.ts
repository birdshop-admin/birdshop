import { randomUUID, createHmac } from "node:crypto";
import { assertSameOrigin, privateHeaders, PublicError, publicErrorResponse, readBody, env } from "@/lib/server-config";
import { limitRequest, rateLimit, requestIdentity } from "@/lib/rate-limit";
import { assertHuman } from "@/lib/turnstile";
import { orderToken, tokenHash } from "@/lib/order-access";
import { encryptInventoryCode } from "@/lib/inventory-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

type RequestItem = { slug?: unknown; quantity?: unknown };

function codeFrom(value: unknown): string {
  if (typeof value !== "string" || value.length > 30)
    throw new PublicError("Enter a valid 16-digit Rewarble voucher code.", 400);
  const normalized = value.replace(/[ -]/g, "");
  if (!/^\d{16}$/.test(normalized))
    throw new PublicError("Enter a valid 16-digit Rewarble voucher code.", 400);
  return normalized;
}

/**
 * A manual request is not a payment and never holds inventory.
 * Raw codes are encrypted BEFORE database insertion, never logged or emailed.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (process.env.BIRDSHOP_REWARBLE_MANUAL_ENABLED !== "true")
      throw new PublicError("Manual voucher requests are not available yet.", 503);

    const body = JSON.parse(await readBody(request, 8192)) as {
      name?: unknown; email?: unknown; code?: unknown; claimedValue?: unknown;
      items?: RequestItem[]; turnstileToken?: unknown;
    };
    await limitRequest(request, "rewarble-request", 3, 3600);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!name || name.length > 120 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
      throw new PublicError("Enter a valid name and email address.", 400);

    await rateLimit("rewarble-email", email, 2, 3600);

    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20)
      throw new PublicError("Add products to your cart before submitting a voucher.", 400);
    const items = body.items.map(item => ({
      slug: typeof item?.slug === "string" ? item.slug : "",
      quantity: Number(item?.quantity),
    }));
    if (new Set(items.map(item => item.slug)).size !== items.length ||
        items.some(item => !/^[a-z0-9][a-z0-9-]{0,119}$/.test(item.slug) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) ||
        items.reduce((sum, item) => sum + item.quantity, 0) > 10)
      throw new PublicError("Your cart has invalid quantities or duplicate products.", 400);

    const claimed = Number(body.claimedValue);
    const claimedCents = Math.round(claimed * 100);
    if (!Number.isFinite(claimed) || claimed < .5 || claimed > 999999.99 ||
        !Number.isSafeInteger(claimedCents) || Math.abs(claimed * 100 - claimedCents) > .00001)
      throw new PublicError("Enter the voucher's face value in USD.", 400);

    const voucherCode = codeFrom(body.code);
    const db = createAdminClient();
    const { data: catalog, error: productsError } = await db.from("products")
      .select("id,slug,name,price,stock,is_visible,inventory_mode")
      .in("slug", items.map(i => i.slug));
    if (productsError || !catalog || catalog.length !== items.length)
      throw new PublicError("An item is unavailable. Refresh the cart.", 409);

    let expectedCents = 0;
    const cart = items.map(item => {
      const product = catalog.find(p => p.slug === item.slug);
      if (!product || !product.is_visible || product.inventory_mode !== "keys" ||
          Number(product.stock) < item.quantity)
        throw new PublicError("An item is unavailable. Refresh the cart.", 409);
      const unitCents = Math.round(Number(product.price) * 100);
      if (!Number.isSafeInteger(unitCents) || unitCents < 50 || unitCents > 99999999)
        throw new PublicError("Invalid product price. Refresh the cart.", 409);
      const lineCents = unitCents * item.quantity;
      expectedCents += lineCents;
      return { id: product.id, slug: product.slug, name: product.name,
        quantity: item.quantity, unit_cents: unitCents, line_cents: lineCents };
    });
    if (expectedCents > 99999999)
      throw new PublicError("Cart total is too large.", 400);

    // Bot checks, if configured, happen before storing sensitive voucher data.
    await assertHuman(body.turnstileToken, requestIdentity(request), "rewarble");

    const id = randomUUID();
    const codeHash = createHmac("sha256", env("BIRDSHOP_RATE_LIMIT_SECRET"))
      .update("birdshop-rewarble-code:" + voucherCode).digest("hex");
    const encryptedCode = encryptInventoryCode(voucherCode);
    const { error } = await db.from("birdshop_rewarble_requests").insert({
      id, access_hash: tokenHash(orderToken(id)),
      customer_name: name, customer_email: email,
      cart, expected_cents: expectedCents, claimed_cents: claimedCents,
      code_hash: codeHash, code_hint: voucherCode.slice(-4),
      encrypted_code: encryptedCode, status: "pending_review",
    });
    if (error) {
      // Deliberately do not log the code or SQL body.
      throw new PublicError("Voucher request unavailable or already submitted. Contact support.", 409);
    }

    await db.from("birdshop_rewarble_audit")
      .insert({ request_id: id, event: "submitted" });

    return Response.json({
      status: "pending_review",
      statusUrl: "/rewarble-request?token=" + orderToken(id),
      message: "Submitted for owner review. This is not a paid order. No stock is reserved.",
    }, { status: 202, headers: privateHeaders });
  } catch (error) {
    return publicErrorResponse(error,
      "Voucher request could not be submitted. Please retry or contact support.", 400);
  }
}
