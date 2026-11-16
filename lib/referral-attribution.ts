import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Fail closed: referrals must never interrupt payment or expose customer data. */
export async function attachReferralToCheckout(attemptId: string, cookieHeader: string | null) {
 const match = cookieHeader?.match(/(?:^|;\s*)birdshop_referral=([A-Z0-9]{6,20})(?:;|$)/);
 if (!match) return;
 const { error } = await createAdminClient().rpc("birdshop_attach_referral", {
  p_attempt_id:attemptId,p_code:match[1],
 });
 if (error) console.error("BirdShop referral attribution unavailable", { code:error.code });
}
