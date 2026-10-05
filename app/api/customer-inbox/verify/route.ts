import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertSameOrigin,
  privateHeaders,
  PublicError,
  readBody,
} from "@/lib/server-config";
import { limitRequest } from "@/lib/rate-limit";
import {
  INBOX_COOKIE,
  inboxCookieOptions,
  inboxError,
  inboxTokenHash,
  newInboxToken,
  validInboxToken,
} from "@/lib/customer-inbox";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "inbox-verify", 20, 900);
    const body = JSON.parse(await readBody(request, 2048));
    if (!validInboxToken(body.token))
      throw new PublicError(
        "This link is invalid. Request a new sign-in email.",
        400,
      );
    const session = newInboxToken(),
      remember = body.remember === true,
      db = createAdminClient();
    const { data, error } = await db.rpc("birdshop_customer_verify_link", {
      p_link_hash: inboxTokenHash(body.token),
      p_session_hash: inboxTokenHash(session),
      p_remember: remember,
    });
    if (error) throw new Error("Verification unavailable");
    if (!data)
      throw new PublicError(
        "This link has expired or was already used. Request a new sign-in email.",
        400,
      );
    const jar = await cookies(),
      previous = jar.get(INBOX_COOKIE)?.value;
    if (validInboxToken(previous))
      await db
        .from("birdshop_customer_sessions")
        .delete()
        .eq("token_hash", inboxTokenHash(previous));
    jar.set(INBOX_COOKIE, session, {
      ...inboxCookieOptions,
      ...(remember ? { maxAge: 30 * 86400 } : {}),
    });
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    return inboxError(error);
  }
}
