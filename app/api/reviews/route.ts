import { publicErrorResponse } from "@/lib/server-config";
import {
  assertSameOrigin,
  readBody,
  privateHeaders,
} from "@/lib/server-config";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import { serverRpc } from "@/lib/payment-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { services } from "@/lib/services";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "submit-review", 5, 1800);
    const body = JSON.parse(await readBody(request));
    const type = String(body.p_type ?? "");
    const contact = String(body.p_contact_handle ?? "").trim();
    const slug = String(body.p_subject_slug ?? "");
    if (
      body.website ||
      !["Product", "Service"].includes(type) ||
      !Number.isInteger(body.p_rating) ||
      body.p_rating < 1 ||
      body.p_rating > 5 ||
      contact.length < 2 ||
      contact.length > 240 ||
      slug.length > 160
    )
      throw new Error("Enter valid review details.");
    await rateLimit("review-contact", contact.toLowerCase(), 3, 3600);
    let subject: string;
    if (type === "Service") {
      const service = services[slug];
      if (!service) throw new Error("Choose a service to review.");
      subject = service.name;
    } else {
      const { data, error } = await createAdminClient()
        .from("products")
        .select("name")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) throw new Error("Choose a product to review.");
      subject = data.name;
    }
    const data = await serverRpc("submit_review", {
      p_type: type,
      p_reviewer: String(body.p_reviewer ?? ""),
      p_contact_handle: contact,
      p_rating: body.p_rating,
      p_title: String(body.p_title ?? ""),
      p_body: String(body.p_body ?? ""),
      p_subject_slug: slug,
      p_subject: subject,
      p_meta: String(body.p_meta ?? ""),
    });
    return Response.json({ data }, { headers: privateHeaders });
  } catch (error) {
    return publicErrorResponse(
      error,
      "Your review could not be submitted. Check your details and try again.",
      400,
    );
  }
}
