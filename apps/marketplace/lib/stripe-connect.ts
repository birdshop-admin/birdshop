import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketplaceStripe } from "@/lib/stripe";
import { env, siteUrl } from "@/lib/server-config";

export type ConnectMapping = {
  seller_id: string; stripe_account_id: string | null; country: string;
  creation_key: string; creation_started_at: string;
  creation_payload: { display_name: string; contact_email: string };
  transfers_status: string; closed: boolean;
  requirements: RequirementNotice[]; future_requirements: RequirementNotice[];
};
export type RequirementNotice = { description: string; awaiting: string; deadline: string; errors: string[] };
export function eligibleConnectCountries() {
  const countries = env("STRIPE_CONNECT_ALLOWED_COUNTRIES").split(",").map(c => c.trim().toUpperCase());
  if (!countries.length || countries.some(c => !/^[A-Z]{2}$/.test(c)))
    throw new Error("STRIPE_CONNECT_ALLOWED_COUNTRIES must list eligible ISO two-letter seller countries.");
  return [...new Set(countries)];
}
export async function getSellerConnect(sellerId: string): Promise<ConnectMapping | null> {
  const { data, error } = await createAdminClient().from("birdshop_seller_connect_accounts")
    .select("*").eq("seller_id", sellerId).maybeSingle();
  if (error) throw new Error("Could not load seller Stripe Connect configuration.");
  return data;
}
function requirements(entries: Stripe.V2.Core.Account.Requirements.Entry[] | undefined): RequirementNotice[] {
  return (entries ?? []).map(e => ({ description: e.description, awaiting: e.awaiting_action_from,
    deadline: e.minimum_deadline.status, errors: e.errors.map(error => error.description) }));
}
export async function refreshSellerConnect(mapping: ConnectMapping) {
  if (!mapping.stripe_account_id) return mapping;
  const observedAt = new Date().toISOString();
  const account = await getMarketplaceStripe().v2.core.accounts.retrieve(mapping.stripe_account_id, {
    include: ["configuration.recipient", "requirements", "future_requirements", "identity"],
  });
  if (account.livemode || account.metadata?.birdshop_seller_id !== mapping.seller_id ||
      account.identity?.country?.toUpperCase() !== mapping.country)
    throw new Error("Connected account ownership or country does not match the seller mapping.");
  const snapshot = {
    transfers_status: account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ?? "pending",
    closed: account.closed ?? false,
    requirements: requirements(account.requirements?.entries),
    future_requirements: requirements(account.future_requirements?.entries),
    updated_at: observedAt,
  };
  const { error } = await createAdminClient().from("birdshop_seller_connect_accounts")
    .update(snapshot).eq("seller_id", mapping.seller_id).eq("stripe_account_id", account.id).lte("updated_at", observedAt);
  if (error) throw new Error("Could not save Stripe verification status.");
  return { ...mapping, ...snapshot };
}
/** Caller identity comes from Supabase auth.getUser(), never from a form or query string. */
export async function ensureSellerConnect(sellerId: string, userId: string, email: string, country: string) {
  const normalized = country.trim().toUpperCase();
  if (!eligibleConnectCountries().includes(normalized)) throw new Error("This seller country is not enabled for BirdShop Connect.");
  const db = createAdminClient();
  const { data, error } = await db.rpc("birdshop_prepare_connect", {
    p_seller: sellerId, p_user: userId, p_country: normalized, p_email: email,
  });
  if (error || !data) throw new Error("Unable to prepare this approved seller's Connect account. Check ownership and country.");
  let mapping = data as ConnectMapping;
  if (!mapping.stripe_account_id) {
    // Stripe may forget idempotency keys after 24h. Never blindly create a second account.
    if (Date.now() - Date.parse(mapping.creation_started_at) >= 23 * 3600_000)
      throw new Error("Connect creation needs owner reconciliation before retrying (creation request is over 23 hours old).");
    const account = await getMarketplaceStripe().v2.core.accounts.create({
      ...mapping.creation_payload,
      dashboard: "express",
      identity: { country: mapping.country },
      defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      metadata: { birdshop_seller_id: mapping.seller_id },
    }, { idempotencyKey: `birdshop-connect-${mapping.creation_key}` });
    const saved = await db.from("birdshop_seller_connect_accounts")
      .update({ stripe_account_id: account.id }).eq("seller_id", sellerId).is("stripe_account_id", null);
    if (saved.error) throw new Error("Stripe created the account but saving its mapping failed. Retry this same request.");
    const persisted = await getSellerConnect(sellerId);
    if (persisted?.stripe_account_id !== account.id) throw new Error("Connected account mapping conflict; owner reconciliation required.");
    mapping = persisted;
  }
  return refreshSellerConnect(mapping);
}
export async function createSellerAccountLink(mapping: ConnectMapping) {
  if (!mapping.stripe_account_id || mapping.closed) throw new Error("Seller Stripe account is unavailable.");
  const link = await getMarketplaceStripe().v2.core.accountLinks.create({
    account: mapping.stripe_account_id,
    use_case: { type: "account_onboarding", account_onboarding: {
      configurations: ["recipient"],
      refresh_url: `${siteUrl()}/sell/connect/refresh`,
      return_url: `${siteUrl()}/sell/connect/return`,
      collection_options: { fields: "eventually_due", future_requirements: "include" },
    } },
  });
  // Single-use URLs are redirected to immediately; never stored, emailed, or logged.
  return link.url;
}
export async function sellerStripeBalance(mapping: ConnectMapping) {
  if (!mapping.stripe_account_id || mapping.closed) return null;
  const balance = await getMarketplaceStripe().balance.retrieve({}, { stripeAccount: mapping.stripe_account_id });
  return { pending: balance.pending.filter(b => b.currency === "usd").reduce((n, b) => n + b.amount, 0),
    available: balance.available.filter(b => b.currency === "usd").reduce((n, b) => n + b.amount, 0) };
}
export const CONNECT_EVENT_TYPES = new Set([
  "v2.core.account.created", "v2.core.account.updated", "v2.core.account.closed",
  "v2.core.account[configuration.recipient].updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[requirements].updated", "v2.core.account[future_requirements].updated",
  "v2.core.account[identity].updated", "v2.core.account[defaults].updated",
]);
