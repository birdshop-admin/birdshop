import { createAdminClient } from "@/lib/supabase/admin";
import { tokenHash } from "@/lib/order-access";
import { privateHeaders } from "@/lib/server-config";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return Response.json({ error: "Request not found." }, { status: 404, headers: privateHeaders });

  try {
    const { data, error } = await createAdminClient().from("birdshop_rewarble_requests")
      .select("status,expected_cents,currency,created_at,expires_at")
      .eq("access_hash", tokenHash(token)).single();
    if (error || !data)
      return Response.json({ error: "Request not found." }, { status: 404, headers: privateHeaders });
    return Response.json({
      status: data.status,
      total: Number(data.expected_cents) / 100,
      currency: data.currency,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      notice: "Manual review only. This is not a paid order and inventory has not been reserved.",
    }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: "Status is temporarily unavailable." }, { status: 503, headers: privateHeaders });
  }
}
