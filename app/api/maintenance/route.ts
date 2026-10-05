import { timingSafeEqual } from "node:crypto";
import { env, privateHeaders } from "@/lib/server-config";
import { runMaintenance } from "@/lib/maintenance";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await runMaintenance(), { headers: privateHeaders });
  } catch {
    return Response.json(
      { error: "Maintenance will retry on its next run." },
      { status: 500 },
    );
  }
}
