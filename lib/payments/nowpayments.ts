import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Future provider adapter. Intentionally not wired to the existing product
 * checkout / inventory reservation system: Stripe remains the only settlement
 * authority until a separate provider-aware order finalization migration exists.
 */
export type NowPaymentsInvoice = {
  id: string;
  invoice_url: string;
};

export type NowPaymentsPaymentStatus =
  | "waiting"
  | "confirming"
  | "confirmed"
  | "sending"
  | "partially_paid"
  | "finished"
  | "failed"
  | "refunded"
  | "expired";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(input)
        .sort()
        .map((key) => [key, canonicalize(input[key])]),
    );
  }
  return value;
}

/**
 * NOWPayments' IPN HMAC-SHA512 is calculated over key-sorted JSON.
 * Use the original decoded JSON values: do not change amount number types.
 */
export function verifyNowPaymentsIpn(
  payload: unknown,
  providedSignature: string | null,
  secret: string,
): boolean {
  if (!providedSignature || !/^[0-9a-f]{128}$/i.test(providedSignature) || !secret)
    return false;
  const calculated = createHmac("sha512", secret)
    .update(JSON.stringify(canonicalize(payload)))
    .digest();
  const received = Buffer.from(providedSignature, "hex");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

/** Never interpret partial payment or "confirmed" as a fulfilled order. */
export function nowPaymentsState(status: string) {
  if (status === "finished") return "settled" as const;
  if (status === "partially_paid") return "requires_review" as const;
  if (["failed", "refunded", "expired"].includes(status))
    return "unsuccessful" as const;
  return "pending" as const;
}

export async function createNowPaymentsInvoice(input: {
  orderId: string;
  amountUsd: number;
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
  /** Never accept amounts or order IDs directly from untrusted browser input. */
}): Promise<NowPaymentsInvoice> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY?.trim();
  if (process.env.BIRDSHOP_CRYPTO_INVOICES_ENABLED !== "true" || !apiKey)
    throw new Error("Crypto invoices are not configured or enabled.");
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.orderId) ||
      !Number.isFinite(input.amountUsd) || input.amountUsd <= 0 ||
      ![input.callbackUrl, input.successUrl, input.cancelUrl].every(url => {
        try { return new URL(url).protocol === "https:"; } catch { return false; }
      })) throw new Error("Invalid server-side crypto invoice details.");

  const sandbox = process.env.NOWPAYMENTS_SANDBOX === "true";
  const endpoint = sandbox
    ? "https://api-sandbox.nowpayments.io/v1/invoice"
    : "https://api.nowpayments.io/v1/invoice";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      price_amount: input.amountUsd.toFixed(2),
      price_currency: "usd",
      order_id: input.orderId,
      ipn_callback_url: input.callbackUrl,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error("Crypto invoice provider unavailable.");
  const value = (await response.json()) as Partial<NowPaymentsInvoice>;
  if (typeof value.id !== "string" || typeof value.invoice_url !== "string")
    throw new Error("Invalid crypto invoice response.");
  const url = new URL(value.invoice_url);
  if (url.protocol !== "https:" || !/(^|\.)nowpayments\.io$/i.test(url.hostname))
    throw new Error("Untrusted crypto invoice destination.");
  return { id: value.id, invoice_url: url.toString() };
}
