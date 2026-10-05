export type Revenue = {
  currency: string;
  gross: number;
  refunds: number;
  net: number;
  paid_orders: number;
  average_order: number;
  digital_orders: number;
  service_orders: number;
  digital_net: number;
  service_net: number;
};
export type Report = {
  period_days: number | null;
  bucket: "day" | "month";
  updated_at: string;
  paid_orders: number;
  units: number;
  views: number;
  visitors: number;
  revenue: Revenue[];
  series: {
    day: string;
    views: number;
    visitors: number;
    units: number;
    paid_orders: number;
    revenue: Revenue[];
  }[];
  products: {
    product_id: string | null;
    product_name: string;
    currency: string;
    units: number;
    gross: number;
  }[];
};
export type Overview = {
  updated_at: string;
  revenue: Revenue[];
  paid_orders: number;
  units: number;
  live_now: number;
  open_chats: number;
  awaiting_reply: number;
  assigned_chats: number;
  paid_services: number;
  delivery_issues: number;
  pending_digital: number;
  email_issues: number;
  payment_issues: number;
  inventory: { available: number; reserved: number; sold: number };
  low_stock_count: number;
  low_stock: { name: string; available: number }[];
  recent_orders: {
    reference: string;
    customer_name: string;
    order_type: string;
    payment_status: string;
    delivery_status: string;
    order_status: string;
    total: number;
    currency: string;
    paid_at: string;
  }[];
  activity: {
    kind: string;
    title: string;
    detail: string;
    occurred_at: string;
    href: string;
  }[];
};
export const formatMoney = (value: number | string, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Number(value));
export const formatCount = (value: number) =>
  Number(value).toLocaleString("en-US");
export const statusText = (value: string) => value.replaceAll("_", " ");
