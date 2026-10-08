const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// One storefront format everywhere: "$1,250.00" (catalog prices are USD).
export function formatUSD(value: number | string) {
  const amount = Number(value);

  return usd.format(Number.isFinite(amount) ? amount : 0);
}
