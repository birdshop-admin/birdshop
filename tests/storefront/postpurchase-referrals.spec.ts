import { expect, test } from "@playwright/test";

const privateToken = "a".repeat(64);
const orderData = {
  order: {
    reference: "BS-QA-001",
    total: 20,
    currency: "USD",
    payment_status: "paid",
    refunded_amount: 0,
    fulfillment_status: "fulfilled",
    delivery_status: "sent",
  },
  items: [{ quantity: 1, product_name: "QA Digital key", platform: "PC", region: "Global" }],
};

async function showOrder(page: import("@playwright/test").Page, enabled: boolean, alreadyRecorded = false) {
  await page.route("**/api/orders/access?token=*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...orderData, referralClaimEnabled: enabled, referralAlreadyRecorded: alreadyRecorded }),
    }),
  );
  await page.goto("/orders/access?token=" + privateToken);
  await expect(page.getByRole("heading", { name: "BS-QA-001" })).toBeVisible();
}

test("post-purchase referral entry is disabled unless rollout flag is on", async ({ page }) => {
  await showOrder(page, false);
  await expect(page.getByRole("heading", { name: "Referred by someone?" })).toHaveCount(0);
});

test("approved paid order shows a mobile-friendly one-time referral claim", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/referrals/claim", async route => {
    const body = route.request().postDataJSON();
    expect(body.token).toBe(privateToken);
    expect(body.code).toBe("BSABC123");
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        status: "verified",
        message: "Your friend has been credited as a verified referred buyer. Their reward remains pending until fulfillment and review.",
      }),
    });
  });
  await showOrder(page, true);
  await expect(page.getByRole("heading", { name: "Referred by someone?" })).toBeVisible();
  await page.getByRole("textbox", { name: "Friend's referral code" }).fill("bsabc123");
  await page.getByRole("button", { name: "Credit friend" }).click();
  await expect(page.getByRole("button", { name: "Verified" })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "verified referred buyer" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("an existing referral cannot be overwritten through the private order UI", async ({ page }) => {
  await showOrder(page, true, true);
  await expect(page.getByRole("heading", { name: "Your referral is recorded." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Friend's referral code" })).toHaveCount(0);
});

test("server-side rejection does not falsely mark a referral verified", async ({ page }) => {
  await page.route("**/api/referrals/claim", route =>
    route.fulfill({
      status: 409, contentType: "application/json",
      body: JSON.stringify({ error: "Referral rewards are limited to your first paid BirdShop purchase." }),
    }),
  );
  await showOrder(page, true);
  await page.getByRole("textbox", { name: "Friend's referral code" }).fill("BSABC123");
  await page.getByRole("button", { name: "Credit friend" }).click();
  await expect(page.getByRole("status").filter({ hasText: "limited to your first paid" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Credit friend" })).toBeEnabled();
});
