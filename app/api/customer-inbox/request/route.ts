import { Resend } from "resend";
import {
  assertSameOrigin,
  env,
  privateHeaders,
  PublicError,
  readBody,
  siteUrl,
} from "@/lib/server-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitRequest, rateLimit } from "@/lib/rate-limit";
import {
  inboxError,
  inboxTokenHash,
  newInboxToken,
} from "@/lib/customer-inbox";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await limitRequest(request, "inbox-login-ip", 5, 900);
    const body = JSON.parse(await readBody(request, 2048));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new PublicError("Enter a valid email address.", 400);
    await rateLimit("inbox-login-email", email, 3, 900);
    const token = newInboxToken(),
      hash = inboxTokenHash(token),
      db = createAdminClient();
    const { error } = await db
      .from("birdshop_customer_login_links")
      .insert({
        token_hash: hash,
        email,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    if (error) throw new Error("Unable to create link");
    // Every valid mailbox receives the same flow; no conversation-existence lookup.
    // Fragment credentials are not sent in HTTP request URLs or referrers.
    const link = `${siteUrl()}/service-chat/verify#token=${token}`;
    const sent = await new Resend(env("RESEND_API_KEY")).emails.send(
      {
        from: env("BIRDSHOP_EMAIL_FROM"),
        to: email,
        subject: "Your BirdShop conversations",
        text: `Open your BirdShop inbox\n\nVerify your email to see your conversations: ${link}\n\nThis link expires in 15 minutes and works once. You can choose to remember this device after opening it. If you did not request this email, ignore it. Do not forward this link.`,
        html: `<div style="background:#f4f0e6;color:#263326;padding:32px;font:16px/1.7 Georgia,serif"><p style="font:11px Arial;letter-spacing:.18em">BIRDSHOP / PRIVATE INBOX</p><h1 style="font-size:30px;font-weight:500">Your conversations, all together.</h1><p>Verify your email to return to your BirdShop conversations.</p><p><a href="${link}" style="display:inline-block;background:#465b40;color:#fffdf7;padding:14px 22px;border-radius:8px;text-decoration:none">Open my inbox</a></p><p style="font:12px/1.7 Arial">This link expires in 15 minutes and works once. You can choose to remember this device after opening it. If you did not request this email, ignore it. Do not forward this link.</p></div>`,
      },
      { idempotencyKey: `inbox-login-${hash}` },
    );
    if (sent.error || !sent.data?.id)
      throw new Error("Email delivery unavailable");
    const cutoff = new Date(Date.now() - 86400000).toISOString();
    await db
      .from("birdshop_customer_login_links")
      .delete()
      .lt("expires_at", cutoff);
    await db
      .from("birdshop_customer_sessions")
      .delete()
      .lt("expires_at", cutoff);
    return Response.json(
      {
        ok: true,
        message:
          "Your sign-in link is on its way. Check your inbox and spam folder.",
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return inboxError(error);
  }
}
