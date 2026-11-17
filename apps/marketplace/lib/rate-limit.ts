import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, PublicError } from "@/lib/server-config";

// Shared, atomic limits work across serverless instances. Store hashes, not raw IPs/emails.
export async function rateLimit(
  scope: string,
  identity: string,
  limit: number,
  seconds: number,
) {
  const key = createHmac("sha256", env("BIRDSHOP_RATE_LIMIT_SECRET"))
    .update(`${scope}:${identity}`)
    .digest("hex");
  const { data, error } = await createAdminClient().rpc("birdshop_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error)
    throw new Error(
      "Unable to check request limits. Please try again shortly.",
    );
  if (data !== true)
    throw new PublicError(
      "Too many requests. Please wait a moment and try again.",
      429,
      seconds,
    );
}

// Vercel sets this header at its trusted edge. Else use a conservative shared bucket.
export function requestIdentity(request: Request) {
  return process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
    : "shared";
}

export async function limitRequest(
  request: Request,
  scope: string,
  limit: number,
  seconds: number,
) {
  await rateLimit(scope, requestIdentity(request), limit, seconds);
}
