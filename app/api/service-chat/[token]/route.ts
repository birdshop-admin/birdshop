import {
  assertSameOrigin,
  privateHeaders,
  readBody,
  isUuid,
  PublicError,
  publicErrorResponse,
} from "@/lib/server-config";
import { rateLimit } from "@/lib/rate-limit";
import { serverRpc } from "@/lib/payment-service";
type Context = { params: Promise<{ token: string }> };
async function getToken(context: Context) {
  const { token } = await context.params;
  if (token.length < 20 || token.length > 200) throw new Error("Unavailable");
  return token;
}
export async function GET(request: Request, context: Context) {
  try {
    const token = await getToken(context);
    await rateLimit("chat-read", token, 60, 60);
    const query = new URL(request.url).searchParams;
    const before = query.get("before");
    if (before && !isUuid(before)) throw new Error("Unavailable");
    return Response.json(
      await serverRpc("birdshop_v3_read_chat", {
        p_token: token,
        p_before: before,
        p_mark_read: query.get("notify") !== "1",
      }),
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof PublicError && error.status === 429) {
      return Response.json(
        { error: "Chat is catching up. Updates will resume shortly." },
        { status: 429, headers: { ...privateHeaders, "Retry-After": "60" } },
      );
    }
    return Response.json(
      { error: "Conversation unavailable. Please wait and retry." },
      { status: 404, headers: privateHeaders },
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
      throw new Error("Invalid");
    await serverRpc("birdshop_v3_send_message", {
      p_token: token,
      p_body: body.message.trim(),
      p_request_id: body.requestId,
    });
    return Response.json(
      await serverRpc("birdshop_get_service_chat", { p_token: token }),
      { headers: privateHeaders },
    );
  } catch (error) {
    return publicErrorResponse(
      error,
      "Unable to send message. Check your message or wait before retrying.",
      400,
    );
  }
}
