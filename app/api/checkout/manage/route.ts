import {
  assertSameOrigin,
  privateHeaders,
  publicErrorResponse,
  readBody,
} from "@/lib/server-config";

import { tokenHash } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { recoverCheckoutAttempt } from "@/lib/maintenance";

import {
  startCheckout,
  type CheckoutAttempt,
} from "@/lib/payment-service";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const { token, action } = JSON.parse(await readBody(request));

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !["check", "resume", "cancel"].includes(action)
    ) {
      throw new Error();
    }

    await rateLimit("checkout-manage", token, 20, 60);

    const db = createAdminClient();

    async function readAttempt(): Promise<CheckoutAttempt> {
      const { data, error } = await db
        .from("birdshop_checkout_attempts")
        .select("*")
        .eq("access_hash", tokenHash(token))
        .eq("kind", "product")
        .single();

      if (error || !data) throw new Error();

      return data as CheckoutAttempt;
    }

    let attempt = await readAttempt();

    const terminal = (value: CheckoutAttempt) =>
      Boolean(value.order_id) ||
      ["paid", "expired", "cancelled", "failed"].includes(value.status);

    if (action === "cancel" && !terminal(attempt)) {
      const { error } = await db
        .from("birdshop_checkout_attempts")
        .update({
          cancel_requested_at: new Date().toISOString(),
          next_check_at: new Date().toISOString(),
        })
        .eq("id", attempt.id)
        .in("status", ["creating", "open", "processing", "attention"]);

      if (error) throw new Error();

      attempt = await readAttempt();
    }

    // Recovery verifies Stripe before releasing inventory.
    if (
      !terminal(attempt) &&
      (attempt.stripe_session_id || attempt.cancel_requested_at)
    ) {
      await recoverCheckoutAttempt(attempt);
      attempt = await readAttempt();
    }

    let url: string | null = null;

    if (
      action === "resume" &&
      !terminal(attempt) &&
      !attempt.cancel_requested_at &&
      ["creating", "open"].includes(attempt.status)
    ) {
      url = await startCheckout(attempt);
      attempt = await readAttempt();
    }

    if (terminal(attempt) || attempt.cancel_requested_at) {
      url = null;
    }

    return Response.json(
      {
        status: attempt.status,
        cancelling:
          Boolean(attempt.cancel_requested_at) && !terminal(attempt),
        orderToken: attempt.order_id ? token : null,
        expiresAt: attempt.expires_at,
        items: (attempt.cart ?? []).map(({ name, quantity }) => ({
          name,
          quantity,
        })),
        total: Number(attempt.expected_cents) / 100,
        currency: attempt.currency,
        url,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return publicErrorResponse(
      error,
      "We could not confirm this checkout. Your reservation has not been cleared. Retry shortly or contact BirdShop.",
      409,
    );
  }
}