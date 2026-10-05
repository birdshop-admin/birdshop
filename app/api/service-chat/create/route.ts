import { isUuid, readBody } from "@/lib/server-config";
import { after } from "next/server";
import { assertSameOrigin, privateHeaders } from "@/lib/server-config";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import { serverRpc } from "@/lib/payment-service";
import { drainEmailJobs } from "@/lib/email-jobs";
import { services } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "new-chat", 10, 1800);
    const body = JSON.parse(await readBody(request));
    if (!isUuid(body.request_id)) throw new Error("Invalid request.");
    if (body.website)
      return Response.json(
        { error: "Unable to submit this request." },
        { status: 400 },
      );
    const type = String(body.p_conversation_type ?? "");
    const email = String(body.p_customer_email ?? "")
      .trim()
      .toLowerCase();
    if (
      !["service", "product", "general"].includes(type) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 320
    )
      throw new Error("Choose a request type and enter a valid email.");
    await rateLimit("new-chat-email", email, 5, 1800);
    const service =
      type === "service" ? services[String(body.p_service_slug)] : null;
    if (type === "service" && (!service || !service.available))
      throw new Error("Choose an available service.");
    let product: {
      slug: string;
      name: string;
      platform: string;
      region: string;
    } | null = null;
    if (type === "product") {
      const { data, error } = await createAdminClient()
        .from("products")
        .select("slug,name,platform,region")
        .eq("slug", String(body.p_product_slug))
        .maybeSingle();
      if (error || !data) throw new Error("Choose a valid product.");
      product = data;
    }
    const data = await serverRpc("birdshop_v2_create_chat_once", {
      p_request_id: body.request_id,
      p_input: {
        p_conversation_type: type,
        p_customer_name: String(body.p_customer_name ?? "").trim(),
        p_customer_email: email,
        p_customer_contact: String(body.p_customer_contact ?? "").trim(),
        p_subject: String(body.p_subject ?? "").trim(),
        p_message: String(body.p_message ?? "").trim(),
        p_service_slug: service?.slug ?? null,
        p_service_name: service?.name ?? null,
        p_package_id: service ? "custom" : null,
        p_package_name: service ? "Custom" : null,
        p_product_slug: product?.slug ?? null,
        p_product_name: product?.name ?? null,
        p_product_platform: product?.platform ?? null,
        p_product_region: product?.region ?? null,
      },
    });
    after(async () => {
      await drainEmailJobs(2).catch(() => undefined);
    });
    return Response.json(
      { data, emailStatus: "queued" },
      { headers: privateHeaders },
    );
  } catch {
    return Response.json(
      {
        error:
          "Unable to process this request. Check your details or wait before retrying.",
      },
      { status: 400, headers: privateHeaders },
    );
  }
}
export const maxDuration = 60;
