import { timingSafeEqual } from "node:crypto";
import { env, privateHeaders } from "@/lib/server-config";
import { reconcileMarketplacePayments } from "@/lib/marketplace-payments";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request){
  const expected=Buffer.from(`Bearer ${env("MARKETPLACE_CRON_SECRET")}`);
  const actual=Buffer.from(request.headers.get("authorization")??"");
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return Response.json({error:"Unauthorized"},{status:401});
  try{await reconcileMarketplacePayments();return Response.json({ok:true},{headers:privateHeaders});}
  catch{return Response.json({error:"Marketplace reconciliation will retry."},{status:500});}
}
