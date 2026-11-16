import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/storefront",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    { command: "node tests/storefront/catalog-fixture.mjs", port: 54321, reuseExistingServer: false },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3100",
      port: 3100,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "qa-placeholder",
        SUPABASE_SECRET_KEY: "qa-placeholder",
        BIRDSHOP_SITE_URL: "http://127.0.0.1:3100",
      },
    },
  ],
});
