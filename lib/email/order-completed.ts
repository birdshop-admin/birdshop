export type OrderCompletedEmailData = {
  orderReference: string; customerName: string | null; serviceName: string;
  packageName: string | null; amount: number; refunded: number; currency: string;
  completedAt: string; chatUrl: string | null; supportUrl: string;
};
function escape(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
export function utcStamp(value: string) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ") + " UTC";
}
// Sent once per order when staff first mark a paid service order completed.
export function orderCompletedCustomerEmail(data: OrderCompletedEmailData) {
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: data.currency.toUpperCase() }).format(value);
  const amount = money(data.amount);
  const subject = `${data.orderReference} · Order completed`;
  const title = "Your order has been completed.";
  const intro = `Hi ${data.customerName || "there"}, BirdShop has completed your ${data.serviceName} order. Thank you for your purchase.`;
  const rows = [
    ["Order", data.orderReference], ["Service", data.serviceName],
    // Fixed packages are named; custom-quote work has no package line.
    ...(data.packageName && !/^custom( quote)?$/i.test(data.packageName.trim()) ? [["Package", data.packageName]] : []),
    ["Amount paid", amount],
    ...(data.refunded > 0 ? [["Refunded", money(data.refunded)]] : []),
    ["Status", "Completed"], ["Completed at", utcStamp(data.completedAt)],
  ];
  const url = data.chatUrl || data.supportUrl;
  const label = data.chatUrl ? "Open private chat" : "Contact BirdShop";
  return {
    subject,
    text: `${title}\n\n${intro}\n\n${rows.map(([key, value]) => `${key}: ${value}`).join("\n")}\n\nQuestions about this order? ${label}: ${url}\n\nKeep your private link safe.`,
    html: `<div style="background:#08140e;padding:28px 12px;font:14px/1.7 Arial,sans-serif;color:#213629">
<table role="presentation" style="width:100%;max-width:620px;margin:auto;border:1px solid #c8cdbc;border-radius:18px;overflow:hidden;border-spacing:0;background:#f2efe4">
<tr><td style="padding:25px 30px;background:#11241a;color:#eae7d8;letter-spacing:4px;font-size:11px">BIRDSHOP · ORDER COMPLETED</td></tr>
<tr><td style="padding:30px"><h1 style="font:32px/1.2 Georgia,serif;margin:0 0 18px">${escape(title)}</h1>
<p style="color:#52624e">${escape(intro)}</p>
<table role="presentation" style="width:100%;border-spacing:0;margin:24px 0;background:#e9e6da;border-radius:12px;padding:12px">
${rows.map(([key, value]) => `<tr><td style="padding:12px 6px;border-bottom:1px solid #d5d8c9;color:#617058;font-size:11px">${escape(key)}</td><td style="padding:12px 6px;border-bottom:1px solid #d5d8c9;font-weight:600">${escape(value)}</td></tr>`).join("")}
</table><p style="margin:26px 0"><a href="${escape(url)}" style="display:block;padding:15px;text-align:center;background:#435b3c;color:#fffdf4;text-decoration:none;border-radius:9px;font-weight:600">${escape(label)}</a></p>
<p style="font-size:12px;color:#687461">Questions about this order? Reply in your private chat or contact BirdShop with your order reference.</p></td></tr></table></div>`,
  };
}
