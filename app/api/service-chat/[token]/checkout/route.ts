import {
  readBody,
  PublicError,
  publicErrorResponse,
} from "@/lib/server-config";
import { assertSameOrigin, isUuid, privateHeaders } from "@/lib/server-config";
import { rateLimit, limitRequest } from "@/lib/rate-limit";
import {
  serverRpc,
  startCheckout,
  type CheckoutAttempt,
} from "@/lib/payment-service";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    const { token } = await context.params;
    const body = JSON.parse(await readBody(request));
    if (
      !isUuid(body.paymentRequestId) ||
      token.length < 20 ||
      token.length > 200
    )
      return Response.json(
        { error: "Invalid checkout request." },
        { status: 400 },
      );
    await limitRequest(request, "service-checkout-ip", 30, 60);
    await rateLimit("service-checkout", token, 8, 60);
    for (let n = 0; n < 2; n++) {
      const attempt = await serverRpc<CheckoutAttempt>(
        "birdshop_v2_begin_service_checkout",
        { p_request_id: body.paymentRequestId, p_token: token },
      );
      const url = await startCheckout(attempt);
      if (url)
        return Response.json({ ok: true, url }, { headers: privateHeaders });
    }
    return Response.json(
      { error: "The previous checkout expired. Please try again." },
      { status: 409, headers: privateHeaders },
    );
  } catch (error) {
    if (!(error instanceof PublicError))
      console.error("BirdShop service checkout failed", {
        errorType: error instanceof Error ? error.name : "unknown",
      });
    return publicErrorResponse(
      error,
      "Checkout is unavailable. Refresh your conversation or contact BirdShop before retrying.",
      409,
    );
  }
}

export const maxDuration = 60;
