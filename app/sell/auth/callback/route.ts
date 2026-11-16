import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const url = new URL("/sell", request.url);
  let response = NextResponse.redirect(url);

  // Never redirect to user-supplied destinations.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({name,value}) => request.cookies.set(name,value));
          response = NextResponse.redirect(url);
          values.forEach(({name,value,options}) => response.cookies.set(name,value,options));
        }
      }
    }
  );
  let authenticated = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authenticated = !error;
  } else if (tokenHash && type === "email") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    authenticated = !error;
  }
  if (!authenticated) url.searchParams.set("notice","invalid-code");
  return response;
}
