import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./tests/browser",fullyParallel:false,workers:1,timeout:60000,use:{baseURL:"http://127.0.0.1:3101",trace:"retain-on-failure",screenshot:"only-on-failure",launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined},webServer:[
 {command:"node tests/browser/fixture.mjs",port:54322,reuseExistingServer:false},
 {command:"npm run start -- --hostname 127.0.0.1 --port 3101",port:3101,reuseExistingServer:false,env:{NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54322",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"qa-placeholder",SUPABASE_SECRET_KEY:"qa-placeholder",MARKETPLACE_SITE_URL:"https://market.birdshop.test",STRIPE_CONNECT_ALLOWED_COUNTRIES:"CA,GB",BIRDSHOP_RATE_LIMIT_SECRET:"qa-marketplace-only-rate-limit-secret",BIRDSHOP_MARKETPLACE_CHECKOUT_ENABLED:"false"}},
]});
