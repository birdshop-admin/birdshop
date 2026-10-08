import {
  assertSameOrigin,
  privateHeaders,
  readBody,
  isUuid,
  PublicError,
  publicErrorResponse,
} from "@/lib/server-config";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import { serverRpc } from "@/lib/payment-service";
type Context = { params: Promise<{ token: string }> };
type ChatPayload = {
  customer_email?: unknown;
  customer_contact?: unknown;
  messages?: { metadata?: Record<string, unknown> | null }[];
} & Record<string, unknown>;

const NOT_FOUND = /^Conversation (not found|unavailable)\.$/;

async function getToken(context: Context) {
  const { token } = await context.params;
  if (token.length < 20 || token.length > 200)
    throw new PublicError("Conversation unavailable.", 404);
  return token;
}

// The browser only needs the payment-request link from message metadata. Staff IDs,
// order IDs and the customer's own contact details stay server-side, so a forwarded
// chat link exposes as little as possible.
function customerView(payload: ChatPayload) {
  const rest: ChatPayload = { ...payload };
  delete rest.customer_email;
  delete rest.customer_contact;
  return {
    ...rest,
    messages: (payload.messages ?? []).map((message) => {
      const requestId = message.metadata?.payment_request_id;
      return {
        ...message,
        metadata: typeof requestId === "string" ? { payment_request_id: requestId } : {},
      };
    }),
  };
}

export async function GET(request: Request, context: Context) {
  try {
    const token = await getToken(context);
    // Per-network cap stops random-token floods; off Vercel there is no trusted
    // client address, and a shared bucket would throttle every customer's polling.
    if (process.env.VERCEL === "1")
      await limitRequest(request, "chat-read-ip", 240, 60);
    await rateLimit("chat-read", token, 60, 60);
    const query = new URL(request.url).searchParams;
    const before = query.get("before");
    if (before && !isUuid(before))
      throw new PublicError("Conversation unavailable.", 404);
    const chat = await serverRpc<ChatPayload>(
      "birdshop_v3_read_chat",
      {
        p_token: token,
        p_before: before,
        p_mark_read: query.get("notify") !== "1",
      },
      [NOT_FOUND],
    );
    return Response.json(customerView(chat), { headers: privateHeaders });
  } catch (error) {
    if (error instanceof PublicError && error.status === 429) {
      return Response.json(
        { error: "Chat is catching up. Updates will resume shortly." },
        { status: 429, headers: { ...privateHeaders, "Retry-After": "60" } },
      );
    }
    // Unknown and removed chats look identical; temporary failures keep polling alive.
    if (error instanceof PublicError)
      return Response.json(
        { error: "Conversation unavailable. Check your private link." },
        { status: 404, headers: privateHeaders },
      );
    return Response.json(
      { error: "Chat is temporarily unavailable. Retrying shortly." },
      { status: 503, headers: privateHeaders },
    );
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const token = await getToken(context);
    await rateLimit("chat-send", token, 10, 60);
    const body = JSON.parse(await readBody(request));
    if (
      !isUuid(body.requestId) ||
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 4000
    )
      throw new PublicError("Write a message of up to 4,000 characters.", 400);
    await serverRpc("birdshop_v3_send_message", {
      p_token: token,
      p_body: body.message.trim(),
      p_request_id: body.requestId,
    });
    return Response.json(
      customerView(
        await serverRpc<ChatPayload>("birdshop_get_service_chat", {
          p_token: token,
        }),
      ),
      { headers: privateHeaders },
    );
  } catch (error) {
    return publicErrorResponse(
      error,
      "Unable to send message. The chat may be closed, or you may need to wait a moment before retrying.",
      400,
    );
  }
}
