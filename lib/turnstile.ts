import "server-only";
import { PublicError } from "@/lib/server-config";

// Cloudflare Turnstile is optional. It is enforced only when BOTH keys are set, so
// a half-finished setup can never block every checkout.
export function turnstileEnabled() {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
}

export async function assertHuman(
  token: unknown,
  ip: string,
  action: string,
) {
  if (!turnstileEnabled()) return;

  if (typeof token !== "string" || !token || token.length > 2048) {
    throw new PublicError("Complete the security check, then try again.", 400);
  }

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY!,
    response: token,
  });
  if (ip && ip !== "shared" && ip !== "unknown") body.set("remoteip", ip);

  let result: { success?: boolean; action?: string };
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new Error("Turnstile unavailable");
    result = await response.json();
  } catch {
    throw new PublicError(
      "The security check is unavailable right now. Please try again in a minute.",
      503,
    );
  }

  if (result.success !== true || result.action !== action) {
    throw new PublicError(
      "The security check expired or failed. Complete it again, then retry.",
      400,
    );
  }
}
