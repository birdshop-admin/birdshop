import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin/login") || path === "/admin/logout")
    return response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data, error } = await supabase.auth.getClaims();
  if (
    error &&
    (error.name === "AuthRetryableFetchError" || Number(error.status) >= 500)
  )
    return new NextResponse(
      "Authentication is temporarily unavailable. Please retry shortly.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  if (
    !error &&
    data?.claims?.sub &&
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  )
    return response;
  if (path === "/admin/session/heartbeat")
    return NextResponse.json(
      { ok: false },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "?reason=session";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
