import { readBody } from "@/lib/server-config";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { assertSameOrigin, privateHeaders } from "@/lib/server-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import { drainEmailJobs } from "@/lib/email-jobs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "recover-chat", 5, 900);
    const body = JSON.parse(await readBody(request));
    const reference = String(body.reference ?? "")
      .trim()
      .toUpperCase();
    const email = String(body.contact ?? "")
      .trim()
      .toLowerCase();
    if (
      reference.length > 80 ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      return Response.json(
        { error: "Enter your reference and email address." },
        { status: 400 },
      );
    await rateLimit("recover-email", email, 3, 900);
    const db = createAdminClient();
    const { data, error } = await db
      .from("service_conversations")
      .select("id")
      .eq("reference", reference)
      .eq("customer_email", email)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("Recovery is temporarily unavailable.");
    if (data) {
      const { error: saveError } = await db.from("birdshop_email_jobs").insert({
        dedupe_key: `recovery/${randomUUID()}`,
        kind: "recovery",
        entity_id: data.id,
      });
      if (saveError) throw new Error("Recovery is temporarily unavailable.");
    }
    // Same acknowledgement and background scheduling for matches and non-matches.
    after(async () => {
      await drainEmailJobs(2).catch(() => undefined);
    });
    return Response.json(
      {
        ok: true,
        message:
          "If those details match a conversation, we will email its private return link. Check your inbox and spam folder.",
      },
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
