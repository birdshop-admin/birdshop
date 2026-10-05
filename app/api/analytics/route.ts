import { readBody } from "@/lib/server-config";
import { assertSameOrigin, isUuid } from "@/lib/server-config";
import { limitRequest } from "@/lib/rate-limit";
import { serverRpc } from "@/lib/payment-service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "analytics", 120, 60);
    const body = JSON.parse(await readBody(request));
    if (
      !isUuid(body.sessionId) ||
      typeof body.path !== "string" ||
      !body.path.startsWith("/") ||
      body.path.startsWith("/admin")
    )
      return new Response(null, { status: 204 });
    const path = body.path.split(/[?#]/)[0];
    const allowed = [
      "/",
      "/products",
      "/services",
      "/reviews",
      "/contact",
      "/faqs",
      "/cart",
      "/how-to-order",
      "/service-chat",
      "/checkout/return",
      "/orders/access",
    ];
    const safePath = allowed.includes(path)
      ? path
      : path.startsWith("/products/")
        ? "/products/item"
        : path.startsWith("/services/")
          ? "/services/item"
          : "/other";
    await serverRpc("birdshop_track_activity", {
      p_session_id: body.sessionId,
      p_path: safePath,
      p_record_view: body.recordView === true,
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 429 });
  }
}
