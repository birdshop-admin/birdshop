import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const { data: r, error } = await createAdminClient()
    .from("reviews")
    .select("id,status,reviewer,initials,rating,title,body,subject,type,meta,created_at")
    .eq("id", id).eq("status", "approved").maybeSingle();
  if (error || !r) return new Response("Not found", { status: 404 });

  // Match the public review card's dark theme, burgundy initials, gold stars,
  // Georgia typography and two-column subject/details footer.
  const stars = "★".repeat(Math.max(1, Math.min(5, Number(r.rating) || 1))) +
    "☆".repeat(5 - Math.max(1, Math.min(5, Number(r.rating) || 1)));
  const date = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" })
    .format(new Date(r.created_at));
  const text = (value: unknown, max: number) => String(value ?? "").slice(0, max);
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#090909", color: "#f5f2ed", padding: 48, fontFamily: "Georgia, serif", flexDirection: "column", border: "2px solid #333", borderRadius: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 64, height: 64, borderRadius: 40, background: "#810b1d", alignItems: "center", justifyContent: "center", fontSize: 23 }}>
            {text(r.initials || "AN", 3)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ fontSize: 27 }}>{text(r.reviewer, 44)}</div>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "#c2bfbb", letterSpacing: 2 }}>COMMUNITY REVIEW</div>
          </div>
        </div>
        <div style={{ fontSize: 21, color: "#c2bfbb" }}>{date}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28 }}>
        <div style={{ fontSize: 34, color: "#e2b88b", letterSpacing: 3 }}>{stars}</div>
        <div style={{ fontSize: 19, color: "#c2bfbb" }}>{Number(r.rating)}.0</div>
      </div>
      <div style={{ fontSize: 36, marginTop: 20, lineHeight: 1.2 }}>{text(r.title, 100)}</div>
      <div style={{ fontSize: 25, marginTop: 14, lineHeight: 1.45, color: "#c2bfbb", flexGrow: 1, overflow: "hidden" }}>{text(r.body, 390)}</div>
      <div style={{ display: "flex", width: "100%", borderTop: "1px solid #ffffff26", paddingTop: 20, marginTop: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", width: "50%", gap: 8 }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "#c2bfbb", letterSpacing: 2 }}>{text(r.type, 20).toUpperCase()}</div>
          <div style={{ fontSize: 23 }}>{text(r.subject, 48)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: "50%", borderLeft: "1px solid #ffffff26", paddingLeft: 22, gap: 8 }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "#c2bfbb", letterSpacing: 2 }}>DETAILS</div>
          <div style={{ fontSize: 23 }}>{text(r.meta || (r.type === "Product" ? "Digital Product" : "Service Experience"), 48)}</div>
        </div>
      </div>
    </div>,
    { width: 1000, height: 640, headers: { "Cache-Control": "public, max-age=60" } },
  );
}
