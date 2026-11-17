import {test,expect,type Page} from "@playwright/test";
export async function signIn(page:Page,id="00000000-0000-4000-8000-000000000007",cookie="birdshop-marketplace-auth"){
 const exp=Math.floor(Date.now()/1000)+3600;const encode=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString("base64url");const email="seller@example.test";
 const token=`${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:id,email,aud:"authenticated",role:"authenticated",iat:exp-3600,exp,qa_visual_repair:true})}.cWEtbG9jYWwtb25seQ`;
 await page.context().addCookies([{name:cookie,value:`base64-${encode({access_token:token,refresh_token:"qa-local",token_type:"bearer",expires_in:3600,expires_at:exp,user:{id,email,email_confirmed_at:"2026-11-01T00:00:00Z",app_metadata:{},user_metadata:{}}})}`,domain:"127.0.0.1",path:"/",sameSite:"Lax"}]);
}
test.beforeEach(async({request})=>{await request.post("http://127.0.0.1:54322/__reset");});
for(const width of [390,1440])test(`marketplace discovery, category filters and seller shop at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto("/");
 await expect(page.getByRole("heading",{name:"Your next great find starts here."})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Marketplace navigation"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Deepwoken progression coaching"})).toBeVisible();
 await expect(page.getByRole("banner").getByRole("link",{name:"Referrals",exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/marketplace-home-${width}.png`,fullPage:true});
 await page.getByRole("navigation",{name:"Game categories"}).getByRole("link",{name:"Game Keys",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Digital adventure key"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Deepwoken progression coaching"})).toHaveCount(0);
 await page.getByRole("link",{name:"View seller",exact:true}).click();
 await expect(page.getByRole("heading",{name:"QA BirdShop seller"})).toBeVisible();
});
test("server filtering supports listing type, search and price order",async({page})=>{
 await page.goto("/?type=game_service&sort=price_low&q=Deepwoken");
 await expect(page.getByRole("heading",{name:"Deepwoken progression coaching"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Digital adventure key"})).toHaveCount(0);
 await page.goto("/?type=digital_product");await expect(page.getByRole("heading",{name:"Digital adventure key"})).toBeVisible();
});
test("seller creates a native BirdShop listing without Stripe catalog access",async({page})=>{
 await signIn(page);await page.goto("/sell/dashboard");
 await page.getByLabel("Listing title").fill("New seller coaching session");
 await page.getByLabel("Description and delivery requirements").fill("A detailed coaching session created entirely in the BirdShop dashboard.");
 await page.getByLabel("Price (USD)").fill("35.00");
 await page.getByRole("button",{name:"Save draft",exact:true}).click();
 await expect(page).toHaveURL(/notice=listing-saved/);
 await expect(page.getByRole("table").filter({has:page.getByRole("columnheader",{name:"Stock",exact:true})})).toContainText("New seller coaching session");
 await expect(page.getByRole("link",{name:/Stripe Dashboard/})).toHaveCount(0);
});
test("official store cookie cannot authenticate marketplace users",async({page})=>{
 await signIn(page,undefined,"sb-127-auth-token");await page.goto("/sell/dashboard");await expect(page).toHaveURL(/\/account\?notice=sign-in-required/);
});
test("seller cannot access marketplace owner controls or official customer endpoints",async({page})=>{
 await signIn(page);await page.goto("/admin/resellers");await expect(page).toHaveURL(/notice=owner-required/);
 for(const route of ["/api/checkout","/api/customer-inbox","/api/orders/access","/api/service-chat/create"]){expect((await page.request.post(route,{data:{}})).status()).toBe(404);}
});
test("marketplace owner administration requires current database owner role",async({page})=>{
 await signIn(page,"00000000-0000-4000-8000-000000000009");await page.goto("/admin/resellers");
 await expect(page.getByRole("heading",{name:"Resellers",exact:true})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Owner navigation"})).toBeVisible();
 await expect(page.getByText("Effective fee: 7.00%",{exact:false})).toBeVisible();
});
test("checkout review is native, test-only, and unavailable until explicitly enabled",async({page})=>{
 await signIn(page,"00000000-0000-4000-8000-000000000008");await page.goto("/marketplace/checkout/30000000-0000-4000-8000-000000000001");
 await expect(page.getByRole("heading",{name:"Review your order."})).toBeVisible();
 await expect(page.getByRole("button",{name:"Sandbox checkout is not enabled"})).toBeDisabled();
 await expect(page.getByText("$24.00 per unit")).toBeVisible();
});

test("seller email verification sets only the marketplace session cookie",async({page})=>{
 await page.goto("/sell");await page.locator("#seller-login-email").fill("seller@example.test");await page.getByRole("button",{name:"Send sign-in email"}).click();
 await expect(page).toHaveURL(/notice=check-email/);await page.getByText("Have a verification code?",{exact:true}).click();
 await page.locator("#seller-otp-email").fill("seller@example.test");await page.locator("#seller-otp-code").fill("123456");await page.getByRole("button",{name:"Verify and continue"}).click();
 await expect(page.getByRole("link",{name:"Open dashboard",exact:true})).toBeVisible();
 const cookies=await page.context().cookies();expect(cookies.some(c=>c.name.startsWith("birdshop-marketplace-auth"))).toBe(true);expect(cookies.some(c=>c.name.startsWith("sb-127-auth-token"))).toBe(false);
 await page.getByRole("link",{name:"Open dashboard",exact:true}).click();await expect(page.getByRole("heading",{name:"QA BirdShop seller"})).toBeVisible();
});
