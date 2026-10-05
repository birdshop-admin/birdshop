type PaymentDisplay = {
  status: string;
  refund_status?: string | null;
  refunded_amount?: number | string | null;
};
export function paymentLabel(payment: PaymentDisplay) {
  if (payment.refund_status === "full") return "Refunded";
  if (
    payment.refund_status === "partial" ||
    Number(payment.refunded_amount ?? 0) > 0
  )
    return "Partially refunded";
  return payment.status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
