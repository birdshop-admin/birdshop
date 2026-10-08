import { utcStamp } from "./order-completed";

export type PaymentConfirmedEmailData = {
  reference: string; orderReference: string; customerName: string | null;
  customerEmail: string; serviceName: string; packageName: string | null;
  amount: number; currency: string; paidAt: string; chatUrl: string;
};
export type PaymentConfirmedAdminEmailData = PaymentConfirmedEmailData & {
  adminUrl: string; paymentRequestId: string; orderId: string; stripeSessionId: string;
};
function escape(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function render(data: PaymentConfirmedEmailData, adminUrl?: string) {
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: data.currency.toUpperCase() }).format(data.amount);
  const admin = Boolean(adminUrl);
  const subject = `${data.orderReference} · Payment confirmed · ${amount}`;
  const title = admin ? "Paid service order received." : "Your payment is confirmed.";
  const intro = admin
    ? "Payment has been verified. Open the private chat to discuss the requirements before starting work."
    : `Hi ${data.customerName || "there"}, your payment is confirmed. Your private chat is ready to discuss the next steps.`;
  const rows = [
    ["Order", data.orderReference], ["Service", data.serviceName],
    ["Package", data.packageName || "Custom quote"], ["Amount paid", amount],
    ["Payment", "Confirmed"], ["Service fulfillment", "We will email you when your order is completed"],
    ["Paid at", utcStamp(data.paidAt)],
    ...(admin ? [["Customer", data.customerName || "Customer"], ["Email", data.customerEmail]] : []),
  ];
  const url = adminUrl || data.chatUrl;
  const label = admin ? "View paid order chat" : "Open private chat";
  return {
    subject,
    text: `${title}\n\n${intro}\n\n${rows.map(([key, value]) => `${key}: ${value}`).join("\n")}\n\n${label}: ${url}\n\nKeep your private link safe.`,
    html: `<div style="background:#08140e;padding:28px 12px;font:14px/1.7 Arial,sans-serif;color:#213629">
<table role="presentation" style="width:100%;max-width:620px;margin:auto;border:1px solid #c8cdbc;border-radius:18px;overflow:hidden;border-spacing:0;background:#f2efe4">
<tr><td style="padding:25px 30px;background:#11241a;color:#eae7d8;letter-spacing:4px;font-size:11px">BIRDSHOP · PAYMENT CONFIRMED</td></tr>
<tr><td style="padding:30px"><h1 style="font:32px/1.2 Georgia,serif;margin:0 0 18px">${escape(title)}</h1>
<p style="color:#52624e">${escape(intro)}</p>
<table role="presentation" style="width:100%;border-spacing:0;margin:24px 0;background:#e9e6da;border-radius:12px;padding:12px">
${rows.map(([key,value]) => `<tr><td style="padding:12px 6px;border-bottom:1px solid #d5d8c9;color:#617058;font-size:11px">${escape(key)}</td><td style="padding:12px 6px;border-bottom:1px solid #d5d8c9;font-weight:600">${escape(value)}</td></tr>`).join("")}
</table><p style="margin:26px 0"><a href="${escape(url)}" style="display:block;padding:15px;text-align:center;background:#435b3c;color:#fffdf4;text-decoration:none;border-radius:9px;font-weight:600">${label}</a></p>
<p style="font-size:12px;color:#687461">Your payment is confirmed. Service delivery is arranged in your private chat, and we will email you when the order is completed. Keep this link safe.</p></td></tr></table></div>`,
  };
}
export function paymentConfirmedCustomerEmail(data: PaymentConfirmedEmailData) { return render(data); }
export function paymentConfirmedAdminEmail(data: PaymentConfirmedAdminEmailData) { return render(data, data.adminUrl); }
