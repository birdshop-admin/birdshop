import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertSameOrigin,
  isUuid,
  privateHeaders,
  PublicError,
  readBody,
} from "@/lib/server-config";
import { rateLimit } from "@/lib/rate-limit";
import {
  INBOX_COOKIE,
  inboxCookieOptions,
  inboxError,
  inboxTokenHash,
  requireInboxSession,
  validInboxToken,
} from "@/lib/customer-inbox";
export async function GET(request: Request) {
  try {
    const session = await requireInboxSession();
    await rateLimit("inbox-list", session.hash, 60, 60);
    const offset = Number(
      new URL(request.url).searchParams.get("offset") ?? "0",
    );
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      throw new PublicError("Invalid page.", 400);
    const { data, error } = await createAdminClient().rpc(
      "birdshop_customer_list_chats",
      { p_email: session.email, p_offset: offset },
    );
    if (error) throw new Error("Inbox unavailable");
    const rows = data ?? [];
    return Response.json(
      {
        email: session.email,
        conversations: rows.slice(0, 50),
        nextOffset: rows.length > 50 ? offset + 50 : null,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return inboxError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireInboxSession();
    await rateLimit("inbox-open", session.hash, 30, 60);
    const body = JSON.parse(await readBody(request, 2048));
    if (!isUuid(body.conversationId))
      throw new PublicError("Conversation unavailable.", 404);
    const { data, error } = await createAdminClient().rpc(
      "birdshop_customer_open_chat",
      { p_email: session.email, p_conversation_id: body.conversationId },
    );
    if (error) throw new Error("Chat unavailable");
    if (!data) throw new PublicError("Conversation unavailable.", 404);
    return Response.json(
      { url: `/service-chat?token=${encodeURIComponent(data)}` },
      { headers: privateHeaders },
    );
  } catch (error) {
    return inboxError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const jar = await cookies(),
      token = jar.get(INBOX_COOKIE)?.value;
    if (validInboxToken(token)) {
      const { error } = await createAdminClient()
        .from("birdshop_customer_sessions")
        .delete()
        .eq("token_hash", inboxTokenHash(token));
      if (error) throw new Error("Sign-out unavailable");
    }
    jar.set(INBOX_COOKIE, "", { ...inboxCookieOptions, maxAge: 0 });
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    return inboxError(error);
  }
}
