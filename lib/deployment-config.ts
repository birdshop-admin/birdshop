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
  const required = requiredConfiguration.map((name) => {
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
    // Only the key's mode prefix is read, never the key itself.
    const mode =
      name === "STRIPE_SECRET_KEY" && value
        ? /^(sk|rk)_live_/.test(value)
          ? " (LIVE mode: real payments)"
          : /^(sk|rk)_test_/.test(value)
            ? " (TEST mode: no real payments)"
            : ""
        : "";
    return {
      name,
      status: !value
        ? "Missing"
        : valid
          ? `Present — external validity not checked${mode}`
          : "Invalid format",
    };
  });

  // Optional: the checkout bot check runs only when both Turnstile keys are set.
  const turnstileKeys = [
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim(),
    process.env.TURNSTILE_SECRET_KEY?.trim(),
  ].filter(Boolean).length;

  return [
    ...required,
    {
      name: "Turnstile bot check (optional)",
      status:
        turnstileKeys === 2
          ? "On"
          : turnstileKeys === 1
            ? "Off: set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY"
            : "Off",
    },
  ];
}
