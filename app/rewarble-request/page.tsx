import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenHash } from "@/lib/order-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewarble review status | BirdShop", robots: "noindex,nofollow" };

const labels: Record<string,string> = {
  pending_review: "Awaiting owner review",
  redeemed: "Voucher redeemed — manual fulfillment pending",
  rejected: "Voucher request rejected",
  fulfilled: "Manually fulfilled",
};

export default async function RewarbleRequestStatus({
  searchParams,
}: { searchParams: Promise<{token?:string}> }) {
  const { token } = await searchParams;
  let status = "not_found";
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    try {
      const { data } = await createAdminClient().from("birdshop_rewarble_requests")
        .select("status").eq("access_hash",tokenHash(token)).single();
      if (data && typeof data.status === "string") status = data.status;
    } catch { status = "unavailable"; }
  }
  return <main className="page-shell bs-editorial-page">
    <SiteHeader />
    <section style={{minHeight:"65vh",background:"#000",color:"#f5f1ec",
      padding:"clamp(60px,9vw,130px) clamp(24px,10vw,150px)"}}>
      <span style={{color:"#c52844",letterSpacing:".25em",fontSize:11}}>
        BIRDSHOP / MANUAL PAYMENT REVIEW
      </span>
      <h1 style={{font:"italic 400 clamp(42px,6vw,80px)/1.1 Georgia,serif",margin:"22px 0"}}>
        Rewarble request
      </h1>
      <p role="status" style={{font:"18px/1.6 Georgia,serif"}}>
        {labels[status] || (status === "unavailable"
          ? "Review status temporarily unavailable." : "Review request not found.")}
      </p>
      <p style={{maxWidth:620,lineHeight:1.8,color:"#c9c3be"}}>
        A submitted voucher is not a completed payment, and BirdShop does not hold
        inventory while a voucher awaits review. The owner will verify redemption
        before arranging any manual delivery. You can contact support if needed.
      </p>
      <a href="/contact?topic=rewarble-payment" style={{color:"#ee8a9c"}}>Contact support ↗</a>
    </section>
    <SiteFooter />
  </main>;
}
