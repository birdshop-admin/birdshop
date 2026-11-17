/** USD minor units; half-up rounding. Never accept a fee from a browser. */
export const SELLER_TIERS = [
  { name: "Starter", key: "starter", threshold: 0, bps: 800 },
  { name: "Bronze", key: "bronze", threshold: 50_000, bps: 700 },
  { name: "Silver", key: "silver", threshold: 250_000, bps: 600 },
  { name: "Gold", key: "gold", threshold: 1_000_000, bps: 500 },
  { name: "Partner", key: "partner", threshold: null, bps: 400 },
] as const;
export type SellerTier = typeof SELLER_TIERS[number]["key"];
export function commissionAmount(amount: number, bps: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0 ||
      !Number.isInteger(bps) || bps < 0 || bps > 5000)
    throw new Error("Invalid commission amount or basis points.");
  return Number((BigInt(amount) * BigInt(bps) + BigInt(5000)) / BigInt(10000));
}
export function tierProgress(earned: SellerTier, sales: number, partner = false) {
  const current = SELLER_TIERS.find(t => t.key === (partner ? "partner" : earned))!;
  const index = SELLER_TIERS.indexOf(current);
  const next = index < 3 ? SELLER_TIERS[index + 1] : null;
  const remaining = next?.threshold == null ? 0 : Math.max(0, next.threshold - sales);
  return { current, next, remaining, percent: next?.threshold == null ? 100 :
    Math.max(0, Math.min(100, (sales - (current.threshold ?? 0)) /
      (next.threshold - (current.threshold ?? 0)) * 100)) };
}
