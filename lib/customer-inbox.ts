import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateHeaders, PublicError } from "@/lib/server-config";
export const INBOX_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-birdshop-inbox"
    : "birdshop-inbox";
export const newInboxToken = () => randomBytes(32).toString("hex");
export const inboxTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const validInboxToken = (token: unknown): token is string =>
  typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
export const inboxCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export async function requireInboxSession() {
  const token = (await cookies()).get(INBOX_COOKIE)?.value;
  if (!validInboxToken(token))
    throw new PublicError(
      "Please verify your email to view your conversations.",
      401,
    );
  const hash = inboxTokenHash(token);
  const { data, error } = await createAdminClient()
    .from("birdshop_customer_sessions")
    .select("email,expires_at")
    .eq("token_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error("Session unavailable");
  if (!data)
    throw new PublicError(
      "Your session has ended. Verify your email to continue.",
      401,
    );
  return { email: String(data.email), hash };
}
export function inboxError(error: unknown) {
  const status = error instanceof PublicError ? error.status : 503;
  return Response.json(
    {
      error:
        error instanceof PublicError
          ? error.message
          : "Unable to connect right now. Please try again shortly.",
    },
    {
      status,
      headers: {
        ...privateHeaders,
        ...(status === 429
          ? {
              "Retry-After": String(
                error instanceof PublicError ? (error.retryAfter ?? 900) : 900,
              ),
            }
          : {}),
      },
    },
  );
}
