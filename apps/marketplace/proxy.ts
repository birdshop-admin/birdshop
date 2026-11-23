import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { marketplaceCookieOptions } from "@/lib/auth-config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: marketplaceCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const {name,value} of values) request.cookies.set(name,value);
        response = NextResponse.next({ request });
        for (const {name,value,options} of values) response.cookies.set(name,value,options);
      },
    },
  });
  // Refresh only. Each page and action verifies identity and ownership independently.
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/account/:path*", "/sell/:path*", "/admin/:path*", "/marketplace/orders/:path*", "/marketplace/messages/:path*", "/marketplace/checkout/:path*"] };
