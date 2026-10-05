import "server-only";
import { siteUrl } from "@/lib/server-config";
export const requiredConfiguration = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "BIRDSHOP_SITE_URL",
  "BIRDSHOP_EMAIL_FROM",
  "BIRDSHOP_ADMIN_EMAIL",
  "BIRDSHOP_RATE_LIMIT_SECRET",
  "CRON_SECRET",
  "INVENTORY_ENCRYPTION_KEY",
  "BIRDSHOP_ORDER_TOKEN_SECRET",
] as const;
export function configurationChecks() {
  return requiredConfiguration.map((name) => {
    const value = process.env[name]?.trim();
    let valid = Boolean(value);
    if (value && name === "BIRDSHOP_SITE_URL") {
      try {
        siteUrl();
      } catch {
        valid = false;
      }
    }
    if (value && name === "INVENTORY_ENCRYPTION_KEY")
      valid = Buffer.from(value, "base64").length === 32;
    if (
      value &&
      [
        "BIRDSHOP_RATE_LIMIT_SECRET",
        "CRON_SECRET",
        "BIRDSHOP_ORDER_TOKEN_SECRET",
      ].includes(name)
    )
      valid = value.length >= 32;
    return {
      name,
      status: !value
        ? "Missing"
        : valid
          ? "Present — external validity not checked"
          : "Invalid format",
    };
  });
}
