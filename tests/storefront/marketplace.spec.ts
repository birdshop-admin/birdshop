import { test, expect, type Page } from "@playwright/test";
async function sellerSession(page:Page){
  const expiresAt=Math.floor(Date.now()/1000)+3600;
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url");
  const id="00000000-0000-4000-8000-000000000007",email="seller@example.test";
  const token=`${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:id,email,aud:"authenticated",role:"authenticated",exp:expiresAt,iat:expiresAt-3600,qa_visual_repair:true})}.cWEtbG9jYWwtb25seQ`;
  const session={access_token:token,refresh_token:"qa-local-only",token_type:"bearer",expires_in:3600,expires_at:expiresAt,
    user:{id,email,email_confirmed_at:"2026-11-01T00:00:00Z",app_metadata:{},user_metadata:{}}};
  await page.context().addCookies([{name:"sb-127-auth-token",value:`base64-${encode(session)}`,domain:"127.0.0.1",path:"/",sameSite:"Lax"}]);
}
for(const width of [390,1440])test(`seller tier, earnings, refunds and native listing tools at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await sellerSession(page);
  await page.goto("/sell/dashboard");
  await expect(page.getByRole("heading",{name:"QA BirdShop seller"})).toBeVisible();
  await expect(page.getByText("Bronze",{exact:true}).first()).toBeVisible();
  await expect(page.getByText("7.00% effective commission")).toBeVisible();
  await expect(page.getByText("$1,250.00",{exact:true}).first()).toBeVisible();
  await expect(page.getByRole("progressbar",{name:/Progress to Silver/})).toHaveAttribute("value","37.5");
  await expect(page.getByRole("heading",{name:"Stripe Connect"})).toBeVisible();
  await expect(page.getByLabel("Your legal account country")).toHaveValue("");
  await expect(page.getByLabel("Your legal account country").locator("option")).toHaveText(["Select your actual country","Canada","United Kingdom"]);
  await expect(page.getByText("Sandbox mode · Test payments only.",{exact:false})).toBeVisible();
  await expect(page.getByRole("region",{name:"Refund and dispute notices"})).toContainText("$20.00 refunded");
  const transactions=page.getByRole("table").filter({has:page.getByRole("columnheader",{name:"Seller allocation"})});
  await expect(transactions).toContainText("$8.00");await expect(transactions).toContainText("8.00%");await expect(transactions).toContainText("$92.00");
  await expect(page.getByRole("heading",{name:"Create a listing"})).toBeVisible();
  await expect(page.getByLabel("Listing type")).toContainText("Game service");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/marketplace-dashboard-${width}.png`,fullPage:true});
});
test("anonymous visitors cannot enter seller financials or onboarding",async({page})=>{
  await page.goto("/sell/dashboard");await expect(page).toHaveURL(/\/sell\?notice=sign-in-required/);
  await page.goto("/sell/connect/refresh");await expect(page).toHaveURL(/\/sell\?notice=sign-in-required/);
});
