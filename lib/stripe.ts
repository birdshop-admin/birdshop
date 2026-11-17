import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      timeout: 15000,
      maxNetworkRetries: 1,
    });
  }

  return stripeClient;
}

/** Marketplace stays in sandbox until a separate, reviewed launch change. */
export function getMarketplaceStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured for the marketplace sandbox.");
  if (!/^(sk|rk)_test_/.test(key))
    throw new Error("BirdShop marketplace requires a Stripe sandbox/test secret key. Live marketplace payments are disabled.");
  return getStripe();
}
