import { test, expect } from "@playwright/test";

async function dismissInvite(page: import("@playwright/test").Page) {
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Maybe later" }).click();
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`storefront fits ${width}px and exposes navigation`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await dismissInvite(page);
    await expect(page.getByRole("heading", { name: /Play\s*beyond\./ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore services" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width <= 1100) {
      const menu = page.getByRole("button", { name: "Open menu", exact: true });
      await menu.click();
      await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Rewards", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
    } else {
      await page.getByRole("button", { name: "Open all navigation" }).click();
      await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "How to Order", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close all navigation" }).press("Escape");
    }
    await page.screenshot({ path: test.info().outputPath(`home-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("inventory, cart persistence, and sold-out protection survive the redesign", async ({ page }) => {
  await page.goto("/");
  await dismissInvite(page);
  const add = page.getByRole("button", { name: "Add Digital key to cart", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByRole("link", { name: "Open cart with 1 item", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sold-out key is out of stock", exact: true })).toBeDisabled();
  await page.reload();
  await dismissInvite(page);
  await expect(page.getByRole("link", { name: "Open cart with 1 item", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open cart with 1 item", exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText("Digital key", { exact: true }).first()).toBeVisible();
});

test("referral sign-in, service list, and staff login stay reachable", async ({ page }) => {
  await page.goto("/referrals");
  await expect(page.getByRole("heading", { name: "Refer friends. Earn rewards." })).toBeVisible();
  await expect(page.getByLabel("Your email", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("referrals.png"), fullPage: true });
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "Deepwoken progression", exact: true }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("services.png"), fullPage: true });
  await page.goto("/admin/login");
  await expect(page.locator(".storefront-rail")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
});
