import "server-only";

import {
  createClient,
} from "@supabase/supabase-js";

/* =========================================================
   ENVIRONMENT HELPER
========================================================= */

function requireEnvironmentVariable(
  name: string
) {
  const value =
    process.env[name]
      ?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}

/* =========================================================
   ADMIN CLIENT

   SERVER ONLY.

   This client uses the Supabase secret key and therefore
   must never be imported into client/browser code.
========================================================= */

export function createAdminClient() {
  const supabaseUrl =
    requireEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_URL"
    );

  const supabaseSecretKey =
    requireEnvironmentVariable(
      "SUPABASE_SECRET_KEY"
    );

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,

        detectSessionInUrl:
          false,
      },
    }
  );
}