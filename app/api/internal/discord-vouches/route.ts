import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.DISCORD_VOUCH_CRON_SECRET || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  if (process.env.DISCORD_REVIEWS_ENABLED !== "true")
    return Response.json({ status: "disabled" });

  const webhook = process.env.DISCORD_REVIEWS_WEBHOOK_URL || "";
  let url: URL;
  try {
    url = new URL(webhook);
    if (url.protocol !== "https:" ||
      !["discord.com", "discordapp.com"].includes(url.hostname) ||
      !/^\/api\/webhooks\/\d+\/[^/]+$/.test(url.pathname)) throw new Error();
  } catch {
    return Response.json({ error: "Discord webhook not configured" }, { status: 503 });
  }
  const origin = (process.env.BIRDSHOP_PUBLIC_ORIGIN || "https://birdshop.store").replace(/\/$/, "");
  if (!/^https:\/\/[^/]+$/.test(origin))
    return Response.json({ error: "Invalid public origin" }, { status: 503 });

  const db = createAdminClient();
  const { data: claims, error: claimError } = await db.rpc("claim_discord_review_vouches", { p_limit: 5 });
  if (claimError) return Response.json({ error: "Review queue unavailable" }, { status: 503 });

  let delivered = 0, failed = 0;
  for (const claim of claims ?? []) {
    const id = String(claim.review_id);
    try {
      const { data: r, error } = await db.from("reviews")
        .select("id,status,reviewer,rating,title,body,subject,type,created_at")
        .eq("id", id).eq("status", "approved").maybeSingle();
      if (error || !r) throw new Error("Review is not approved or no longer available");
      const reviewUrl = origin + "/reviews#review-" + encodeURIComponent(id);
      const cardUrl = origin + "/api/reviews/card/" + encodeURIComponent(id);
      const safe = (v: unknown, len: number) => String(v ?? "").replaceAll("@", "＠").slice(0, len);
      const payload = {
        username: "BirdShop Reviews",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: safe(r.title, 220) || "BirdShop customer review",
          url: reviewUrl,
          description: "**" + safe(r.reviewer, 80) + "** · " + "★".repeat(Math.min(5, Math.max(1, Number(r.rating)))) +
            "\n" + safe(r.body, 3400),
          color: 0x921027,
          fields: [{ name: "Product / Service", value: safe(r.subject, 250) }],
          image: { url: cardUrl },
          footer: { text: "BirdShop • Approved community review" },
          timestamp: r.created_at,
        }],
      };
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Discord HTTP " + response.status);
      const { error: updateError } = await db.from("discord_review_vouch_outbox")
        .update({ state: "sent", sent_at: new Date().toISOString(), locked_at: null, last_error: null })
        .eq("review_id", id).eq("state", "sending");
      if (updateError) throw updateError;
      delivered++;
    } catch (error) {
      failed++;
      // Leave no private review data in the error log or database.
      const delayMinutes = Math.min(360, Math.pow(2, Math.min(8, Number(claim.attempts) || 1)));
      await db.from("discord_review_vouch_outbox").update({
        state: "pending", locked_at: null,
        last_error: error instanceof Error ? error.message.slice(0, 120) : "Discord delivery error",
        next_attempt_at: new Date(Date.now() + delayMinutes * 60000).toISOString(),
      }).eq("review_id", id).eq("state", "sending");
    }
  }
  return Response.json({ claimed: (claims ?? []).length, delivered, failed });
}
