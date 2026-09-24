import {
  createClient,
} from "@supabase/supabase-js";

/* =========================================================
   BIRDSHOP SERVER-ONLY SUPABASE ADMIN CLIENT

   IMPORTANT:
   Never import this file into a Client Component.

   SUPABASE_SECRET_KEY is the modern server-only Supabase
   secret key.

   It bypasses Row Level Security and must never be exposed
   through NEXT_PUBLIC variables or browser code.
========================================================= */

export function createAdminClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env
      .SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured."
    );
  }

  return createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,
      },
    }
  );
}