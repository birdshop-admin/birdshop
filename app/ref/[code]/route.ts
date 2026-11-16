import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
 const { code: raw } = await params;
 const code = raw.trim().toUpperCase();
 const destination = new URL("/", request.url);
 if (!/^[A-Z0-9]{6,20}$/.test(code)) return NextResponse.redirect(destination);
 const { data, error } = await createAdminClient().from("birdshop_referrers")
  .select("code").eq("code",code).eq("status","approved").maybeSingle();
 if (error || !data) return NextResponse.redirect(destination);
 const response = NextResponse.redirect(destination);
 response.cookies.set("birdshop_referral",code,{
  httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",
  maxAge:60*60*24*30,path:"/"
 });
 return response;
}
